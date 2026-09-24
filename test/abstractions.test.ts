import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, compileSource } from "../src/compiler.js";
import { expandDeclarationSource } from "../src/language/abstractions.js";
import { buildTraceMap } from "../src/language/trace.js";
import type { BuildManifest } from "../src/model.js";

test("field groups expand to ordinary field declarations", () => {
  const source = `application Groups
field group Titled
  title as required text length between 2 and 100
apply fields Titled to Task
`;
  const expanded = expandDeclarationSource(source);
  assert.equal(expanded.ok, true);
  if (!expanded.ok) return;
  assert.ok(
    expanded.source.includes(
      "a Task has a required title as text length between 2 and 100"
    )
  );
  const result = compileSource(source);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const trace = buildTraceMap(source, result.ir);
  const field = result.ir.entities[0]!.fields[0]!;
  assert.ok(trace.links.some((link) => link.irNodeId === field.id));
});

test("state machines expand to validated ordinary actions", () => {
  const abstractSource = `application Workflow
a Task has a status as text default "open"
state machine TaskLifecycle for Task using status
  transition complete
    require status is "open" otherwise "Task must be open"
    set status to "done"
`;
  const explicitSource = `application Workflow
a Task has a status as text default "open"
action complete a Task
  require status is "open" otherwise "Task must be open"
  set status to "done"
`;
  const abstractResult = compileSource(abstractSource);
  const explicitResult = compileSource(explicitSource);
  assert.equal(abstractResult.ok, true);
  assert.equal(explicitResult.ok, true);
  if (!abstractResult.ok || !explicitResult.ok) return;
  assert.equal(canonicalJson(abstractResult.ir), canonicalJson(explicitResult.ir));
});

test("state-machine invariants reject incomplete transitions", () => {
  const result = compileSource(`application InvalidMachine
a Task has a status as text
state machine TaskLifecycle for Task using status
  transition complete
    require status is "open" otherwise "Task must be open"
`);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "E062"));
  }
});

test("LaunchOps state machines preserve the generated snapshot IR", async () => {
  const source = await readFile("examples/launch-ops.intent", "utf8");
  const snapshot = JSON.parse(
    await readFile(
      "examples/launch-ops-generated/intentlang.manifest.json",
      "utf8"
    )
  ) as BuildManifest;
  const result = compileSource(source);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(canonicalJson(result.ir), canonicalJson(snapshot.ir));
  assert.equal(
    source.split(/\r?\n/).filter((line) => /^state machine /.test(line)).length,
    6
  );
  assert.equal(
    source.split(/\r?\n/).filter((line) => /^\s{2}transition /.test(line)).length,
    14
  );
});
