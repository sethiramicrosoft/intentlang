export interface DecimalValue {
  kind: "decimal";
  coefficient: bigint;
  scale: number;
}

export interface MoneyValue {
  kind: "money";
  currency: string;
  amount: DecimalValue;
}

export interface DateValue {
  kind: "date";
  value: string;
}

export interface TimeValue {
  kind: "time";
  value: string;
}

export interface DateTimeValue {
  kind: "datetime";
  value: string;
  epochMilliseconds: number;
}

export interface EnumValue {
  kind: "enum";
  enumName: string;
  member: string;
}

export type TypedValue =
  | bigint
  | string
  | boolean
  | null
  | DecimalValue
  | MoneyValue
  | DateValue
  | TimeValue
  | DateTimeValue
  | EnumValue;

export class TypedExpressionError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "TypedExpressionError";
  }
}

const powerOfTenCache = new Map<number, bigint>([[0, 1n]]);

export function powerOfTen(scale: number): bigint {
  if (!Number.isInteger(scale) || scale < 0 || scale > 1000) {
    throw new TypedExpressionError(
      "X004",
      `Decimal scale ${scale} is outside the supported range 0..1000.`
    );
  }
  const cached = powerOfTenCache.get(scale);
  if (cached !== undefined) return cached;
  const value = 10n ** BigInt(scale);
  powerOfTenCache.set(scale, value);
  return value;
}

export function normalizeDecimal(value: DecimalValue): DecimalValue {
  let { coefficient, scale } = value;
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  return { kind: "decimal", coefficient, scale };
}

export function parseDecimal(raw: string): DecimalValue {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) {
    throw new TypedExpressionError("X001", `"${raw}" is not an exact decimal.`);
  }
  const fraction = match[3] ?? "";
  const coefficient = BigInt(`${match[1]}${match[2]}${fraction}`);
  return normalizeDecimal({
    kind: "decimal",
    coefficient,
    scale: fraction.length
  });
}

export function formatDecimal(value: DecimalValue): string {
  const normalized = normalizeDecimal(value);
  const negative = normalized.coefficient < 0n;
  const digits = (negative
    ? -normalized.coefficient
    : normalized.coefficient
  ).toString();
  if (normalized.scale === 0) {
    return `${negative ? "-" : ""}${digits}`;
  }
  const padded = digits.padStart(normalized.scale + 1, "0");
  const split = padded.length - normalized.scale;
  return `${negative ? "-" : ""}${padded.slice(0, split)}.${padded.slice(split)}`;
}

function align(
  left: DecimalValue,
  right: DecimalValue
): [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  return [
    left.coefficient * powerOfTen(scale - left.scale),
    right.coefficient * powerOfTen(scale - right.scale),
    scale
  ];
}

export function addDecimal(
  left: DecimalValue,
  right: DecimalValue
): DecimalValue {
  const [a, b, scale] = align(left, right);
  return normalizeDecimal({ kind: "decimal", coefficient: a + b, scale });
}

export function subtractDecimal(
  left: DecimalValue,
  right: DecimalValue
): DecimalValue {
  const [a, b, scale] = align(left, right);
  return normalizeDecimal({ kind: "decimal", coefficient: a - b, scale });
}

export function multiplyDecimal(
  left: DecimalValue,
  right: DecimalValue
): DecimalValue {
  return normalizeDecimal({
    kind: "decimal",
    coefficient: left.coefficient * right.coefficient,
    scale: left.scale + right.scale
  });
}

export function divideDecimal(
  left: DecimalValue,
  right: DecimalValue,
  maxScale = 18
): DecimalValue {
  if (right.coefficient === 0n) {
    throw new TypedExpressionError("X005", "Division by zero.");
  }
  let numerator = left.coefficient * powerOfTen(right.scale);
  let denominator = right.coefficient * powerOfTen(left.scale);
  const negative = (numerator < 0n) !== (denominator < 0n);
  numerator = numerator < 0n ? -numerator : numerator;
  denominator = denominator < 0n ? -denominator : denominator;
  let coefficient = numerator / denominator;
  let remainder = numerator % denominator;
  let scale = 0;
  while (remainder !== 0n && scale < maxScale) {
    remainder *= 10n;
    coefficient = coefficient * 10n + remainder / denominator;
    remainder %= denominator;
    scale += 1;
  }
  if (remainder !== 0n) {
    throw new TypedExpressionError(
      "X006",
      `Division is not exact within ${maxScale} decimal places; use an explicit rounding operation.`
    );
  }
  return normalizeDecimal({
    kind: "decimal",
    coefficient: negative ? -coefficient : coefficient,
    scale
  });
}

export function compareDecimal(
  left: DecimalValue,
  right: DecimalValue
): number {
  const [a, b] = align(left, right);
  return a < b ? -1 : a > b ? 1 : 0;
}

export function parseMoney(currency: string, raw: string): MoneyValue {
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new TypedExpressionError(
      "X007",
      `Currency "${currency}" must be a three-letter uppercase code.`
    );
  }
  return { kind: "money", currency, amount: parseDecimal(raw) };
}

function sameCurrency(left: MoneyValue, right: MoneyValue): void {
  if (left.currency !== right.currency) {
    throw new TypedExpressionError(
      "X008",
      `Currency mismatch: ${left.currency} and ${right.currency}.`
    );
  }
}

export function addMoney(left: MoneyValue, right: MoneyValue): MoneyValue {
  sameCurrency(left, right);
  return {
    kind: "money",
    currency: left.currency,
    amount: addDecimal(left.amount, right.amount)
  };
}

export function subtractMoney(left: MoneyValue, right: MoneyValue): MoneyValue {
  sameCurrency(left, right);
  return {
    kind: "money",
    currency: left.currency,
    amount: subtractDecimal(left.amount, right.amount)
  };
}

export function compareMoney(left: MoneyValue, right: MoneyValue): number {
  sameCurrency(left, right);
  return compareDecimal(left.amount, right.amount);
}

export function parseDate(raw: string): DateValue {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) {
    throw new TypedExpressionError("X009", `"${raw}" is not an ISO date.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new TypedExpressionError("X009", `"${raw}" is not a valid date.`);
  }
  return { kind: "date", value: raw };
}

export function parseTime(raw: string): TimeValue {
  const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(raw);
  if (
    !match ||
    Number(match[1]) > 23 ||
    Number(match[2]) > 59 ||
    Number(match[3]) > 59
  ) {
    throw new TypedExpressionError("X010", `"${raw}" is not a valid ISO time.`);
  }
  return { kind: "time", value: raw };
}

export function parseDateTime(raw: string): DateTimeValue {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(
      raw
    )
  ) {
    throw new TypedExpressionError(
      "X011",
      `Datetime "${raw}" must include Z or an explicit offset.`
    );
  }
  const epochMilliseconds = Date.parse(raw);
  if (!Number.isFinite(epochMilliseconds)) {
    throw new TypedExpressionError("X011", `"${raw}" is not a valid datetime.`);
  }
  return { kind: "datetime", value: raw, epochMilliseconds };
}
