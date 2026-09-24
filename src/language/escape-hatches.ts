import { EffectRuntimeError } from "./effects-errors.js";

export interface EscapeHatchDefinition {
  name: string;
  sourceFingerprint: string;
  requiredCapabilities: string[];
  excludedGuarantees: string[];
  timeoutMs: number;
}

export interface EscapeExecutionRequest {
  input: Readonly<Record<string, unknown>>;
  capabilities: readonly string[];
  signal: AbortSignal;
}

export type IsolatedEscapeExecutor = (
  request: EscapeExecutionRequest
) => Promise<unknown>;

export interface EscapeAuditRecord {
  name: string;
  sourceFingerprint: string;
  capabilities: string[];
  excludedGuarantees: string[];
  outcome: "succeeded" | "failed";
  durationMs: number;
  cause?: string;
}

export class EscapeHatchRuntime {
  readonly audit: EscapeAuditRecord[] = [];

  constructor(
    private readonly grantedCapabilities: ReadonlySet<string>,
    private readonly executor?: IsolatedEscapeExecutor
  ) {}

  async execute(
    definition: EscapeHatchDefinition,
    input: Record<string, unknown>
  ): Promise<unknown> {
    if (
      !definition.name ||
      !/^[a-f0-9]{64}$/.test(definition.sourceFingerprint) ||
      definition.requiredCapabilities.length === 0 ||
      definition.excludedGuarantees.length === 0 ||
      definition.timeoutMs < 1 ||
      definition.timeoutMs > 120_000
    ) {
      throw new EffectRuntimeError(
        "I020",
        "Escape hatches require a name, SHA-256 source fingerprint, capabilities, excluded guarantees, and bounded timeout."
      );
    }
    if (
      new Set(definition.requiredCapabilities).size !==
        definition.requiredCapabilities.length ||
      new Set(definition.excludedGuarantees).size !==
        definition.excludedGuarantees.length
    ) {
      throw new EffectRuntimeError(
        "I020",
        "Escape-hatch capabilities and excluded guarantees must be unique."
      );
    }
    const missing = definition.requiredCapabilities.filter(
      (capability) => !this.grantedCapabilities.has(capability)
    );
    if (missing.length > 0) {
      throw new EffectRuntimeError(
        "I021",
        `Escape hatch "${definition.name}" lacks capabilities: ${missing.join(", ")}.`
      );
    }
    if (!this.executor) {
      throw new EffectRuntimeError(
        "I022",
        `Escape hatch "${definition.name}" has no isolated executor.`
      );
    }
    const started = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), definition.timeoutMs);
    try {
      const result = await Promise.race([
        this.executor({
          input: Object.freeze({ ...input }),
          capabilities: Object.freeze([...definition.requiredCapabilities]),
          signal: controller.signal
        }),
        new Promise<never>((_resolve, reject) => {
          controller.signal.addEventListener(
            "abort",
            () =>
              reject(
                new DOMException(
                  `Timed out after ${definition.timeoutMs} ms.`,
                  "AbortError"
                )
              ),
            { once: true }
          );
        })
      ]);
      this.audit.push({
        name: definition.name,
        sourceFingerprint: definition.sourceFingerprint,
        capabilities: [...definition.requiredCapabilities],
        excludedGuarantees: [...definition.excludedGuarantees],
        outcome: "succeeded",
        durationMs: performance.now() - started
      });
      return result;
    } catch (error) {
      const cause =
        error instanceof Error && error.name === "AbortError"
          ? `Escape hatch timed out after ${definition.timeoutMs} ms.`
          : "Isolated escape execution failed.";
      this.audit.push({
        name: definition.name,
        sourceFingerprint: definition.sourceFingerprint,
        capabilities: [...definition.requiredCapabilities],
        excludedGuarantees: [...definition.excludedGuarantees],
        outcome: "failed",
        durationMs: performance.now() - started,
        cause
      });
      throw new EffectRuntimeError("I023", cause);
    } finally {
      clearTimeout(timeout);
    }
  }
}
