import assert from "node:assert/strict";
import test from "node:test";
import { compileSource } from "../src/compiler.js";
import { buildTraceMap } from "../src/language/trace.js";

test("trace map preserves source lines and cross-layer artifacts", () => {
  const source = `application Todo
a Task has a required title as text
a Task has a done as boolean default false
action complete a Task
  require done is false otherwise "Already complete"
  set done to true
`;
  const result = compileSource(source);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const trace = buildTraceMap(source, result.ir, "todo.intent");

  const title = trace.links.find((item) => item.irNodeId === "task-title")!;
  assert.deepEqual(title.source, {
    file: "todo.intent",
    startLine: 2,
    endLine: 2
  });
  const action = trace.links.find((item) => item.irNodeId === "task-complete")!;
  assert.equal(action.source.startLine, 4);
  assert.equal(action.source.endLine, 6);
  assert.ok(action.artifacts.some((artifact) => artifact.path === "app.mjs"));
  assert.ok(action.artifacts.some((artifact) => artifact.path === "app.js"));
});
