import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileSource } from "../src/compiler.js";
import { applyWorkflowAction } from "../src/language/workflow.js";
import type { FieldDefault } from "../src/model.js";

function satisfyingValue(
  operator: string,
  value: FieldDefault
): FieldDefault {
  if (operator === "is") return value;
  if (operator === "is not") {
    return typeof value === "boolean"
      ? !value
      : typeof value === "number"
        ? value + 1
        : `${value}-different`;
  }
  if (typeof value !== "number") return value;
  if (operator === "is greater than") return value + 1;
  if (operator === "is at least") return value;
  if (operator === "is less than") return value - 1;
  return value;
}

function failingValue(operator: string, value: FieldDefault): FieldDefault {
  if (operator === "is not") return value;
  if (operator === "is") {
    return typeof value === "boolean"
      ? !value
      : typeof value === "number"
        ? value + 1
        : `${value}-different`;
  }
  if (typeof value !== "number") return value;
  if (operator === "is greater than") return value;
  if (operator === "is at least") return value - 1;
  if (operator === "is less than") return value;
  return value + 1;
}

test("every LaunchOps action rejects a failed precondition without mutation", async () => {
  const source = await readFile("examples/launch-ops.intent", "utf8");
  const result = compileSource(source);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  for (const action of result.ir.actions) {
    const record: Record<string, FieldDefault> = {};
    for (const precondition of action.preconditions) {
      record[precondition.fieldName] = satisfyingValue(
        precondition.operator,
        precondition.value
      );
    }
    const failed = action.preconditions[0]!;
    record[failed.fieldName] = failingValue(failed.operator, failed.value);
    const before = structuredClone(record);
    const applied = applyWorkflowAction(action, record);
    assert.equal(applied.ok, false, action.id);
    assert.deepEqual(applied.record, before, action.id);
  }
});

test("every LaunchOps action applies only declared assignments when valid", async () => {
  const source = await readFile("examples/launch-ops.intent", "utf8");
  const result = compileSource(source);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  for (const action of result.ir.actions) {
    const record: Record<string, FieldDefault> = { untouched: "preserved" };
    for (const precondition of action.preconditions) {
      record[precondition.fieldName] = satisfyingValue(
        precondition.operator,
        precondition.value
      );
    }
    const applied = applyWorkflowAction(action, record);
    assert.equal(applied.ok, true, action.id);
    assert.equal(applied.record["untouched"], "preserved", action.id);
    for (const assignment of action.assignments) {
      assert.equal(
        applied.record[assignment.fieldName],
        assignment.value,
        action.id
      );
    }
  }
});
