import { createHash } from "node:crypto";
import { EffectRuntimeError } from "./effects-errors.js";

export type TransactionValue =
  | null
  | boolean
  | string
  | bigint
  | TransactionValue[]
  | { [key: string]: TransactionValue };

export type TransactionRecord = Readonly<Record<string, TransactionValue>>;
type MutableTables = Map<string, Map<string, TransactionRecord>>;

export interface TransactionStep {
  name: string;
  execute: (context: TransactionContext) => void | Promise<void>;
}

export interface TransactionDefinition {
  name: string;
  steps: TransactionStep[];
}

export interface TransactionInvocation {
  idempotencyKey: string;
  requestFingerprint: string;
}

export interface TransactionAuditRecord {
  transaction: string;
  idempotencyKey: string;
  requestFingerprint: string;
  outcome: "committed" | "rolled-back" | "replayed";
  completedSteps: string[];
  cause?: string;
}

export interface TransactionResult {
  replayed: boolean;
  completedSteps: string[];
}

interface IdempotencyRecord {
  fingerprint: string;
  result: TransactionResult;
}

function cloneValue(value: TransactionValue): TransactionValue {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)])
    );
  }
  return value;
}

function cloneRecord(record: TransactionRecord): TransactionRecord {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(record).map(([key, value]) => [key, cloneValue(value)])
    )
  );
}

function cloneTables(source: MutableTables): MutableTables {
  return new Map(
    Array.from(source, ([table, records]) => [
      table,
      new Map(
        Array.from(records, ([id, record]) => [id, cloneRecord(record)])
      )
    ])
  );
}

export class TransactionContext {
  constructor(private readonly tables: MutableTables) {}

  read(table: string, id: string): TransactionRecord | undefined {
    const record = this.tables.get(table)?.get(id);
    return record ? cloneRecord(record) : undefined;
  }

  put(table: string, id: string, record: TransactionRecord): void {
    if (!table || !id) {
      throw new EffectRuntimeError("I002", "Transaction writes require table and id.");
    }
    const records = this.tables.get(table) ?? new Map();
    records.set(id, cloneRecord(record));
    this.tables.set(table, records);
  }

  delete(table: string, id: string): void {
    this.tables.get(table)?.delete(id);
  }
}

export class TransactionRuntime {
  private tables: MutableTables;
  private readonly idempotency = new Map<string, IdempotencyRecord>();
  readonly audit: TransactionAuditRecord[] = [];

  constructor(initial: Record<string, Record<string, TransactionRecord>> = {}) {
    this.tables = new Map(
      Object.entries(initial).map(([table, records]) => [
        table,
        new Map(
          Object.entries(records).map(([id, record]) => [id, cloneRecord(record)])
        )
      ])
    );
  }

  snapshot(): Record<string, Record<string, TransactionRecord>> {
    return Object.fromEntries(
      Array.from(this.tables, ([table, records]) => [
        table,
        Object.fromEntries(
          Array.from(records, ([id, record]) => [id, cloneRecord(record)])
        )
      ])
    );
  }

  async execute(
    definition: TransactionDefinition,
    invocation: TransactionInvocation
  ): Promise<TransactionResult> {
    if (!definition.name || definition.steps.length === 0) {
      throw new EffectRuntimeError(
        "I001",
        "A transaction requires a name and at least one step."
      );
    }
    const stepNames = definition.steps.map((step) => step.name);
    if (
      stepNames.some((name) => !name) ||
      new Set(stepNames).size !== stepNames.length
    ) {
      throw new EffectRuntimeError(
        "I001",
        "Transaction step names must be non-empty and unique."
      );
    }
    if (!invocation.idempotencyKey || !invocation.requestFingerprint) {
      throw new EffectRuntimeError(
        "I005",
        "Transactions require an idempotency key and request fingerprint."
      );
    }
    const operationKey = `${definition.name}:${invocation.idempotencyKey}`;
    const existing = this.idempotency.get(operationKey);
    if (existing) {
      if (existing.fingerprint !== invocation.requestFingerprint) {
        throw new EffectRuntimeError(
          "I006",
          `Idempotency key "${invocation.idempotencyKey}" was already used for different input.`
        );
      }
      const result = {
        replayed: true,
        completedSteps: [...existing.result.completedSteps]
      };
      this.audit.push({
        transaction: definition.name,
        ...invocation,
        outcome: "replayed",
        completedSteps: result.completedSteps
      });
      return result;
    }
    const working = cloneTables(this.tables);
    const context = new TransactionContext(working);
    const completedSteps: string[] = [];
    try {
      for (const step of definition.steps) {
        await step.execute(context);
        completedSteps.push(step.name);
      }
      this.tables = working;
      const result = { replayed: false, completedSteps: [...completedSteps] };
      this.idempotency.set(operationKey, {
        fingerprint: invocation.requestFingerprint,
        result
      });
      this.audit.push({
        transaction: definition.name,
        ...invocation,
        outcome: "committed",
        completedSteps: [...completedSteps]
      });
      return result;
    } catch (error) {
      const failedStep = definition.steps[completedSteps.length]?.name ?? "commit";
      this.audit.push({
        transaction: definition.name,
        ...invocation,
        outcome: "rolled-back",
        completedSteps: [...completedSteps],
        cause: `Transaction failed during "${failedStep}".`
      });
      throw error;
    }
  }
}

export function fingerprintTransactionRequest(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    if (typeof item === "bigint") return `${item}n`;
    if (Array.isArray(item)) return item.map(canonical);
    if (item !== null && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right, "en"))
          .map(([key, nested]) => [key, canonical(nested)])
      );
    }
    return item;
  };
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
