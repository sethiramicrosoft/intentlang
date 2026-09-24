import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileSource } from "../src/compiler.js";
import { buildTraceMap } from "../src/language/trace.js";

test("LaunchOps traces every declared security and workflow node", async () => {
  const source = await readFile("examples/launch-ops.intent", "utf8");
  const result = compileSource(source);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const trace = buildTraceMap(source, result.ir, "examples/launch-ops.intent");
  const ids = new Set(trace.links.map((item) => item.irNodeId));

  assert.ok(ids.has(result.ir.application.id));
  assert.ok(ids.has("authentication"));
  for (const entity of result.ir.entities) {
    assert.ok(ids.has(entity.id), entity.id);
    for (const field of entity.fields) assert.ok(ids.has(field.id), field.id);
  }
  for (const relationship of result.ir.relationships) {
    assert.ok(ids.has(relationship.id), relationship.id);
  }
  for (const action of result.ir.actions) assert.ok(ids.has(action.id), action.id);
  for (const role of result.ir.roles) assert.ok(ids.has(role.id), role.id);
  for (const permission of result.ir.permissions) {
    assert.ok(ids.has(permission.id), permission.id);
  }
});
