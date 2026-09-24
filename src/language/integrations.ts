import { EffectRuntimeError } from "./effects-errors.js";

export interface ExternalOperation {
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  requestFields: string[];
  responseFields: string[];
  timeoutMs: number;
  maximumAttempts: number;
  retryableStatuses: number[];
  idempotent: boolean;
  secretReferences: string[];
}

export interface ExternalContract {
  name: string;
  baseUrl: string;
  operations: ExternalOperation[];
}

export interface ExternalTransportRequest {
  url: string;
  method: ExternalOperation["method"];
  body: Readonly<Record<string, unknown>>;
  headers: Readonly<Record<string, string>>;
  signal: AbortSignal;
}

export interface ExternalTransportResponse {
  status: number;
  body: unknown;
}

export type ExternalTransport = (
  request: ExternalTransportRequest
) => Promise<ExternalTransportResponse>;

export type SecretResolver = (reference: string) => Promise<string>;

export interface IntegrationAuditRecord {
  contract: string;
  operation: string;
  outcome: "succeeded" | "failed";
  attempts: number;
  secretReferences: string[];
  status?: number;
  cause?: string;
}

function exactObject(
  value: unknown,
  fields: string[],
  context: string
): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new EffectRuntimeError("I012", `${context} must be an object.`);
  }
  const supplied = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (JSON.stringify(supplied) !== JSON.stringify(expected)) {
    throw new EffectRuntimeError(
      "I012",
      `${context} requires exactly: ${expected.join(", ") || "no fields"}.`
    );
  }
  return Object.freeze({ ...(value as Record<string, unknown>) });
}

export function validateExternalContract(contract: ExternalContract): void {
  if (!contract.name || !/^https:\/\//.test(contract.baseUrl)) {
    throw new EffectRuntimeError(
      "I010",
      "External contracts require a name and HTTPS base URL."
    );
  }
  const names = new Set<string>();
  for (const operation of contract.operations) {
    if (!operation.name || names.has(operation.name)) {
      throw new EffectRuntimeError(
        "I011",
        `External operation "${operation.name}" is missing or duplicated.`
      );
    }
    names.add(operation.name);
    if (
      !operation.path.startsWith("/") ||
      operation.timeoutMs < 1 ||
      operation.timeoutMs > 120_000 ||
      operation.maximumAttempts < 1 ||
      operation.maximumAttempts > 10
    ) {
      throw new EffectRuntimeError(
        "I011",
        `External operation "${operation.name}" has invalid path, timeout, or retry limits.`
      );
    }
    for (const values of [
      operation.requestFields,
      operation.responseFields,
      operation.secretReferences
    ]) {
      if (
        values.some((value) => !value) ||
        new Set(values).size !== values.length
      ) {
        throw new EffectRuntimeError(
          "I011",
          `External operation "${operation.name}" has empty or duplicate field references.`
        );
      }
    }
  }
}

export class ExternalContractRuntime {
  readonly audit: IntegrationAuditRecord[] = [];

  constructor(
    private readonly transport: ExternalTransport,
    private readonly resolveSecret: SecretResolver
  ) {}

  async invoke(
    contract: ExternalContract,
    operationName: string,
    input: Record<string, unknown>,
    options: { idempotencyKey?: string } = {}
  ): Promise<Readonly<Record<string, unknown>>> {
    validateExternalContract(contract);
    const operation = contract.operations.find(
      (candidate) => candidate.name === operationName
    );
    if (!operation) {
      throw new EffectRuntimeError(
        "I011",
        `External operation "${operationName}" is not declared by ${contract.name}.`
      );
    }
    if (
      !operation.idempotent &&
      operation.maximumAttempts > 1 &&
      !options.idempotencyKey
    ) {
      throw new EffectRuntimeError(
        "I013",
        `Operation "${operation.name}" requires an idempotency key for retries.`
      );
    }
    const body = exactObject(input, operation.requestFields, "Integration request");
    const headers: Record<string, string> = {};
    for (const reference of operation.secretReferences) {
      try {
        headers[`x-intentlang-secret-${reference}`] =
          await this.resolveSecret(reference);
      } catch {
        this.audit.push({
          contract: contract.name,
          operation: operation.name,
          outcome: "failed",
          attempts: 0,
          secretReferences: [...operation.secretReferences],
          cause: `Secret reference "${reference}" could not be resolved.`
        });
        throw new EffectRuntimeError(
          "I015",
          `Secret reference "${reference}" could not be resolved.`
        );
      }
    }
    if (options.idempotencyKey) {
      headers["idempotency-key"] = options.idempotencyKey;
    }
    let lastStatus: number | undefined;
    let lastCause = "External operation failed.";
    let attempts = 0;
    for (let attempt = 1; attempt <= operation.maximumAttempts; attempt += 1) {
      attempts = attempt;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), operation.timeoutMs);
      try {
        const response = await Promise.race([
          this.transport({
            url: new URL(operation.path, contract.baseUrl).toString(),
            method: operation.method,
            body,
            headers: Object.freeze({ ...headers }),
            signal: controller.signal
          }),
          new Promise<never>((_resolve, reject) => {
            controller.signal.addEventListener(
              "abort",
              () =>
                reject(
                  new DOMException(
                    `Timed out after ${operation.timeoutMs} ms.`,
                    "AbortError"
                  )
                ),
              { once: true }
            );
          })
        ]);
        lastStatus = response.status;
        if (response.status >= 200 && response.status < 300) {
          const result = exactObject(
            response.body,
            operation.responseFields,
            "Integration response"
          );
          this.audit.push({
            contract: contract.name,
            operation: operation.name,
            outcome: "succeeded",
            attempts: attempt,
            secretReferences: [...operation.secretReferences],
            status: response.status
          });
          return result;
        }
        lastCause = `External operation returned status ${response.status}.`;
        if (!operation.retryableStatuses.includes(response.status)) break;
      } catch (error) {
        if (error instanceof EffectRuntimeError) {
          this.audit.push({
            contract: contract.name,
            operation: operation.name,
            outcome: "failed",
            attempts: attempt,
            secretReferences: [...operation.secretReferences],
            status: lastStatus,
            cause: error.message
          });
          throw error;
        }
        lastCause =
          error instanceof Error && error.name === "AbortError"
            ? `External operation timed out after ${operation.timeoutMs} ms.`
            : "External transport failed.";
      } finally {
        clearTimeout(timeout);
      }
    }
    this.audit.push({
      contract: contract.name,
      operation: operation.name,
      outcome: "failed",
      attempts,
      secretReferences: [...operation.secretReferences],
      status: lastStatus,
      cause: lastCause
    });
    throw new EffectRuntimeError("I014", lastCause);
  }
}
