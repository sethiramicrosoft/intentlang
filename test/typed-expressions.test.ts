import assert from "node:assert/strict";
import test from "node:test";
import {
  addDecimal,
  formatDecimal,
  parseDate,
  parseDateTime,
  parseDecimal,
  parseMoney,
  parseTime,
  TypedExpressionError
} from "../src/language/typed-values.js";
import {
  evaluateExpression,
  inferExpressionType,
  parseExpression
} from "../src/language/typed-expressions.js";

test("exact decimals never use binary floating point", () => {
  assert.equal(
    formatDecimal(addDecimal(parseDecimal("0.1"), parseDecimal("0.2"))),
    "0.3"
  );
  assert.equal(formatDecimal(parseDecimal("0012.3400")), "12.34");
});

test("money preserves currency and rejects mixed-currency arithmetic", () => {
  const expression = parseExpression("price + tax");
  const types = {
    price: { kind: "money", currency: "AUD", scale: 2 } as const,
    tax: { kind: "money", currency: "AUD", scale: 2 } as const
  };
  const value = evaluateExpression(expression, types, {
    price: parseMoney("AUD", "19.95"),
    tax: parseMoney("AUD", "2.00")
  });
  assert.equal(
    value !== null && typeof value === "object" && value.kind === "money"
      ? formatDecimal(value.amount)
      : "",
    "21.95"
  );
  assert.throws(
    () =>
      evaluateExpression(expression, types, {
        price: parseMoney("AUD", "19.95"),
        tax: parseMoney("USD", "2.00")
      }),
    (error: unknown) =>
      error instanceof TypedExpressionError && error.code === "X008"
  );
});

test("division is exact or explicitly fails", () => {
  assert.equal(
    formatDecimal(
      evaluateExpression(
        parseExpression("1 / 8"),
        {},
        {}
      ) as ReturnType<typeof parseDecimal>
    ),
    "0.125"
  );
  assert.throws(
    () => evaluateExpression(parseExpression("1 / 3"), {}, {}),
    (error: unknown) =>
      error instanceof TypedExpressionError && error.code === "X006"
  );
});

test("optional values must coalesce before non-null use", () => {
  const expression = parseExpression('nickname ?? "Unknown"');
  const types = {
    nickname: {
      kind: "optional",
      value: { kind: "text" }
    } as const
  };
  assert.deepEqual(inferExpressionType(expression, types), { kind: "text" });
  assert.equal(
    evaluateExpression(expression, types, { nickname: null }),
    "Unknown"
  );
});

test("operator precedence and short-circuiting are deterministic", () => {
  const expression = parseExpression("2 + 3 * 4 = 14 and enabled");
  const types = { enabled: { kind: "boolean" } as const };
  assert.equal(
    evaluateExpression(expression, types, { enabled: true }),
    true
  );
});

test("ISO date/time values reject invalid or timezone-free input", () => {
  assert.equal(parseDate("2026-09-25").value, "2026-09-25");
  assert.equal(parseTime("09:47:12").value, "09:47:12");
  assert.equal(
    parseDateTime("2026-09-25T09:47:12+10:00").kind,
    "datetime"
  );
  assert.throws(() => parseDate("2026-02-30"));
  assert.throws(() => parseTime("25:00:00"));
  assert.throws(() => parseDateTime("2026-09-25T09:47:12"));
});

test("unknown variables and invalid operand types fail loudly", () => {
  assert.throws(
    () => inferExpressionType(parseExpression("missing + 1"), {}),
    (error: unknown) =>
      error instanceof TypedExpressionError && error.code === "X021"
  );
  assert.throws(
    () =>
      inferExpressionType(parseExpression('"a" - "b"'), {}),
    (error: unknown) =>
      error instanceof TypedExpressionError && error.code === "X022"
  );
});
