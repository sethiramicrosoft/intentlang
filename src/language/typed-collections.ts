import type { TypedValue } from "./typed-values.js";
import { TypedExpressionError } from "./typed-values.js";

export interface RecordSchema {
  name: string;
  fields: string[];
}

export type TypedRecord = Readonly<Record<string, TypedValue>>;

export function createRecord(
  schema: RecordSchema,
  values: Record<string, TypedValue>
): TypedRecord {
  const supplied = Object.keys(values).sort();
  const expected = [...schema.fields].sort();
  if (JSON.stringify(supplied) !== JSON.stringify(expected)) {
    throw new TypedExpressionError(
      "X040",
      `Record ${schema.name} requires exactly: ${expected.join(", ")}.`
    );
  }
  return Object.freeze({ ...values });
}

export function mapCollection(
  values: readonly TypedValue[],
  mapper: (value: TypedValue, index: number) => TypedValue
): readonly TypedValue[] {
  return Object.freeze(values.map(mapper));
}

export function filterCollection(
  values: readonly TypedValue[],
  predicate: (value: TypedValue, index: number) => boolean
): readonly TypedValue[] {
  return Object.freeze(values.filter(predicate));
}

export function foldCollection(
  values: readonly TypedValue[],
  initial: TypedValue,
  reducer: (
    accumulator: TypedValue,
    value: TypedValue,
    index: number
  ) => TypedValue
): TypedValue {
  return values.reduce(reducer, initial);
}

export function matchEnum<T>(
  enumName: string,
  members: readonly string[],
  member: string,
  cases: Record<string, () => T>
): T {
  const missing = members.filter((candidate) => !Object.hasOwn(cases, candidate));
  const extra = Object.keys(cases).filter(
    (candidate) => !members.includes(candidate)
  );
  if (missing.length > 0 || extra.length > 0) {
    throw new TypedExpressionError(
      "X041",
      `Match for ${enumName} must be exhaustive. Missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}.`
    );
  }
  const selected = cases[member];
  if (!selected) {
    throw new TypedExpressionError(
      "X042",
      `"${member}" is not a member of enum ${enumName}.`
    );
  }
  return selected();
}
