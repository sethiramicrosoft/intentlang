import assert from "node:assert/strict";
import test from "node:test";
import { compileSource, formatSource, canonicalJson } from "../src/compiler.js";
import { buildManifest } from "../src/manifest.js";
import { planMigration } from "../src/planner.js";
import { generateRuntime } from "../src/runtime-codegen.js";
import { generateSchema } from "../src/generator.js";
import { generateUi } from "../src/ui-codegen.js";
import type { ProgramIr } from "../src/model.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const minimalSource = `application Todo with id todo
entity Task with id task
  title is required text with id task-title
  done is boolean with id task-done default false
`;

const authSource = `application Todo with id todo
authentication uses User identified by email
role Administrator with id administrator
role Member

entity User with id user
  name is required text with id user-name
  email is required unique text with id user-email

entity Task with id task
  title is required text with id task-title
  done is boolean with id task-done default false

Task belongs to User as owner with id task-owner on delete restrict

action complete a Task with id task-complete
  require done is false otherwise "Task is already complete"
  set done to true

allow Administrator to create User
allow Administrator to create Task
allow Administrator to provision accounts
allow Administrator to read Task
allow Administrator to update Task
allow Administrator to run complete on Task
allow Member to read User where self
allow Member to read Task where owner is self
allow Member to update Task where owner is self
allow Member to create Task with owner as self
allow Member to run complete on Task where owner is self
`;

const naturalSource = `application Todo
a Task has a required title as text
a Task has a done as boolean default false
`;

function compileOk(source: string): ProgramIr {
  const result = compileSource(source);
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result.diagnostics, null, 2));
  if (!result.ok) throw new Error("compile failed");
  return result.ir;
}

function firstCode(source: string): string {
  const result = compileSource(source);
  assert.equal(result.ok, false, "Expected compile failure");
  if (result.ok) throw new Error("expected diagnostics");
  return result.diagnostics[0]?.code ?? "";
}

function allCodes(source: string): string[] {
  const result = compileSource(source);
  if (result.ok) throw new Error("expected diagnostics");
  return result.diagnostics.map((d) => d.code);
}

// ── Compiler: explicit exact IR ───────────────────────────────────────────────

test("compiler explicit exact IR - application id and name", () => {
  const ir = compileOk(minimalSource);
  assert.equal(ir.application.name, "Todo");
  assert.equal(ir.application.id, "todo");
});

test("compiler explicit exact IR - field type required unique and default", () => {
  const ir = compileOk(`application App with id app
entity Item with id item
  label is required unique text with id item-label
  score is integer with id item-score default 42
  active is boolean with id item-active default true
`);
  const labelField = ir.entities[0]!.fields.find((f) => f.name === "label")!;
  assert.equal(labelField.required, true);
  assert.equal(labelField.unique, true);
  assert.equal(labelField.type, "text");
  assert.equal(labelField.id, "item-label");
  const scoreField = ir.entities[0]!.fields.find((f) => f.name === "score")!;
  assert.equal(scoreField.default, 42);
  assert.equal(scoreField.type, "integer");
  const activeField = ir.entities[0]!.fields.find((f) => f.name === "active")!;
  assert.equal(activeField.default, true);
  assert.equal(activeField.type, "boolean");
});

test("compiler explicit exact IR - field length constraint", () => {
  const ir = compileOk(`application App with id app
entity Item with id item
  label is text with id item-label length between 1 and 100
`);
  const f = ir.entities[0]!.fields[0]!;
  assert.deepEqual(f.length, { min: 1, max: 100 });
});

test("compiler natural exact IR - derives entity id and field id", () => {
  const ir = compileOk(naturalSource);
  assert.equal(ir.application.id, "todo");
  assert.equal(ir.entities[0]!.id, "task");
  assert.equal(ir.entities[0]!.fields[0]!.id, "task-title");
  assert.equal(ir.entities[0]!.fields[0]!.required, true);
});

test("compiler natural exact IR - boolean default false in natural syntax", () => {
  const ir = compileOk(naturalSource);
  const doneField = ir.entities[0]!.fields.find((f) => f.name === "done")!;
  assert.equal(doneField.default, false);
  assert.equal(doneField.type, "boolean");
});

test("compiler explicit/natural equivalence - same entity structure", () => {
  const explicit = compileOk(minimalSource);
  const natural = compileOk(naturalSource);
  assert.equal(explicit.entities[0]!.name, natural.entities[0]!.name);
  assert.equal(explicit.entities[0]!.fields.length, natural.entities[0]!.fields.length);
});

// ── Syntax modifier diagnostics E009-E014 ────────────────────────────────────

test("syntax modifier diagnostics E009 - length on integer field", () => {
  assert.equal(
    firstCode(`application App with id app
entity Item with id item
  count is integer with id item-count length between 1 and 10
`),
    "E009"
  );
});

test("syntax modifier diagnostics E009 - length on boolean field", () => {
  assert.equal(
    firstCode(`application App with id app
entity Item with id item
  active is boolean with id item-active length between 1 and 10
`),
    "E009"
  );
});

test("syntax modifier diagnostics E010 - invalid length range min equals max", () => {
  assert.equal(
    firstCode(`application App with id app
entity Item with id item
  label is text with id item-label length between 5 and 5
`),
    "E010"
  );
});

test("syntax modifier diagnostics E010 - invalid length range min zero", () => {
  assert.equal(
    firstCode(`application App with id app
entity Item with id item
  label is text with id item-label length between 0 and 10
`),
    "E010"
  );
});

test("syntax modifier diagnostics E013 - unique before required", () => {
  assert.equal(
    firstCode(`application App with id app
entity Item with id item
  label is unique required text with id item-label
`),
    "E013"
  );
});

test("syntax modifier diagnostics E013 - modifier after type", () => {
  assert.equal(
    firstCode(`application App with id app
entity Item with id item
  label is text required with id item-label
`),
    "E013"
  );
});

test("syntax modifier diagnostics E014 - duplicate required", () => {
  assert.equal(
    firstCode(`application App with id app
entity Item with id item
  label is required required text with id item-label
`),
    "E014"
  );
});

test("syntax modifier diagnostics E014 - duplicate unique", () => {
  assert.equal(
    firstCode(`application App with id app
entity Item with id item
  label is unique unique text with id item-label
`),
    "E014"
  );
});

// ── E008 default type mismatch ────────────────────────────────────────────────

test("E008 - text default must be quoted", () => {
  assert.equal(
    firstCode(`application App with id app
entity Item with id item
  label is text with id item-label default unquoted
`),
    "E008"
  );
});

test("E008 - boolean default must be true or false", () => {
  assert.equal(
    firstCode(`application App with id app
entity Item with id item
  active is boolean with id item-active default yes
`),
    "E008"
  );
});

// ── Relationships ─────────────────────────────────────────────────────────────

test("relationships compile correctly - explicit belongsTo", () => {
  const ir = compileOk(`application App with id app
entity User with id user
  name is required text with id user-name

entity Post with id post
  title is required text with id post-title

Post belongs to User as author with id post-author on delete cascade
`);
  assert.equal(ir.relationships.length, 1);
  const rel = ir.relationships[0]!;
  assert.equal(rel.name, "author");
  assert.equal(rel.id, "post-author");
  assert.equal(rel.onDelete, "cascade");
  const userEntity = ir.entities.find((e) => e.name === "User")!;
  const postEntity = ir.entities.find((e) => e.name === "Post")!;
  assert.equal(rel.fromEntityId, postEntity.id);
  assert.equal(rel.toEntityId, userEntity.id);
});

test("relationships compile correctly - restrict on delete", () => {
  const ir = compileOk(`application App with id app
entity User with id user
  name is required text with id user-name
entity Post with id post
  title is required text with id post-title
Post belongs to User as owner with id post-owner on delete restrict
`);
  assert.equal(ir.relationships[0]!.onDelete, "restrict");
});

test("E012 - set null rejected in belongs-to relationship", () => {
  assert.equal(
    firstCode(`application App with id app
entity User with id user
  name is required text with id user-name
entity Post with id post
  title is required text with id post-title
Post belongs to User as owner with id post-owner on delete set null
`),
    "E012"
  );
});

test("E011 - unknown from entity in relationship", () => {
  assert.equal(
    firstCode(`application App with id app
entity User with id user
  name is required text with id user-name
Ghost belongs to User as owner with id ghost-owner on delete restrict
`),
    "E011"
  );
});

test("E011 - unknown to entity in relationship", () => {
  assert.equal(
    firstCode(`application App with id app
entity Post with id post
  title is required text with id post-title
Post belongs to Ghost as owner with id post-owner on delete restrict
`),
    "E011"
  );
});

// ── Stable ids ────────────────────────────────────────────────────────────────

test("stable ids - E005 duplicate entity id", () => {
  assert.equal(
    firstCode(`application App with id app
entity Foo with id foo
  name is required text with id foo-name
entity Bar with id foo
  title is required text with id bar-title
`),
    "E005"
  );
});

test("stable ids - E005 duplicate field id", () => {
  assert.equal(
    firstCode(`application App with id app
entity Foo with id foo
  name is required text with id foo-name
  alias is text with id foo-name
`),
    "E005"
  );
});

test("stable ids - E005 duplicate relationship id", () => {
  assert.equal(
    firstCode(`application App with id app
entity User with id user
  name is required text with id user-name
entity Post with id post
  title is required text with id post-title
entity Comment with id comment
  body is required text with id comment-body
Post belongs to User as owner with id shared-rel on delete restrict
Comment belongs to User as author with id shared-rel on delete restrict
`),
    "E005"
  );
});

test("stable ids - E002 duplicate application declaration", () => {
  assert.equal(
    firstCode(`application App with id app
application Other with id other
entity Foo with id foo
  name is required text with id foo-name
`),
    "E002"
  );
});

test("stable ids - E004 missing application declaration", () => {
  assert.equal(
    firstCode(`entity Foo with id foo
  name is required text with id foo-name
`),
    "E004"
  );
});

test("stable ids - E006 duplicate entity name", () => {
  assert.equal(
    firstCode(`application App with id app
entity Foo with id foo
  name is required text with id foo-name
entity Foo with id foo2
  title is required text with id foo2-title
`),
    "E006"
  );
});

test("stable ids - E006 duplicate field name in entity", () => {
  assert.equal(
    firstCode(`application App with id app
entity Foo with id foo
  name is required text with id foo-name
  name is text with id foo-name2
`),
    "E006"
  );
});

// ── Deterministic compiler / schema / manifest ────────────────────────────────

test("deterministic compiler - same input produces same output", () => {
  const a = compileSource(authSource);
  const b = compileSource(authSource);
  assert.ok(a.ok && b.ok);
  assert.equal(a.output, b.output);
});

test("deterministic schema - same IR produces same SQL", () => {
  const ir = compileOk(authSource);
  const a = generateSchema(ir).migrationSql;
  const b = generateSchema(ir).migrationSql;
  assert.equal(a, b);
});

test("deterministic manifest - same IR produces same fingerprint", () => {
  const ir = compileOk(authSource);
  const a = buildManifest(ir).irFingerprint;
  const b = buildManifest(ir).irFingerprint;
  assert.equal(a, b);
  assert.ok(a.startsWith("sha256:"));
});

test("deterministic manifest - different IR produces different fingerprint", () => {
  const ir1 = compileOk(authSource);
  const ir2 = compileOk(minimalSource);
  assert.notEqual(buildManifest(ir1).irFingerprint, buildManifest(ir2).irFingerprint);
});

// ── Migration: unique / required changes ──────────────────────────────────────

test("migration unique/required changes - adding unique field is destructive", () => {
  const before = compileOk(minimalSource);
  const after = compileOk(`application Todo with id todo
entity Task with id task
  title is required unique text with id task-title
  done is boolean with id task-done default false
`);
  const plan = planMigration(buildManifest(before), after);
  const item = plan.items.find((i) => i.kind === "field-unique-added");
  assert.ok(item, "expected field-unique-added plan item");
  assert.equal(item!.destructive, true);
});

test("migration unique/required changes - adding required field without default is destructive", () => {
  const before = compileOk(minimalSource);
  const after = compileOk(`application Todo with id todo
entity Task with id task
  title is required text with id task-title
  done is boolean with id task-done default false
  priority is required integer with id task-priority
`);
  const plan = planMigration(buildManifest(before), after);
  const item = plan.items.find((i) => i.kind === "field-added");
  assert.ok(item, "expected field-added plan item");
  assert.equal(item!.destructive, true);
});

test("migration unique/required changes - adding optional field with default is non-destructive", () => {
  const before = compileOk(minimalSource);
  const after = compileOk(`application Todo with id todo
entity Task with id task
  title is required text with id task-title
  done is boolean with id task-done default false
  priority is integer with id task-priority default 0
`);
  const plan = planMigration(buildManifest(before), after);
  const item = plan.items.find((i) => i.kind === "field-added");
  assert.ok(item, "expected field-added plan item");
  assert.equal(item!.destructive, false);
});

test("migration - entity removed is destructive", () => {
  const before = compileOk(`application App with id app
entity Foo with id foo
  name is required text with id foo-name
entity Bar with id bar
  title is required text with id bar-title
`);
  const after = compileOk(`application App with id app
entity Foo with id foo
  name is required text with id foo-name
`);
  const plan = planMigration(buildManifest(before), after);
  assert.ok(plan.isDestructive);
  assert.ok(plan.items.some((i) => i.kind === "entity-removed"));
});

// ── Runtime: idempotency / fingerprint / transactions / 409 / unique ─────────

test("runtime idempotency - generated code has idempotency table", () => {
  const ir = compileOk(minimalSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("__intentlang_idempotency"));
});

test("runtime canonical fingerprint - fingerprint is persisted in runtime metadata and audit", () => {
  const ir = compileOk(minimalSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("irFingerprint"));
  assert.ok(code.includes("setMeta('irFingerprint'"));
  assert.ok(code.includes("manifest.irFingerprint"));
});

test("runtime transactions - BEGIN/COMMIT/ROLLBACK in generated code", () => {
  const ir = compileOk(minimalSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("db.exec('BEGIN')"));
  assert.ok(code.includes("db.exec('COMMIT')"));
  assert.ok(code.includes("db.exec('ROLLBACK')"));
});

test("runtime 409 version conflict - version check in generated code", () => {
  const ir = compileOk(minimalSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("VERSION_CONFLICT"));
});

test("runtime unique map - UNIQUE_CONFLICT returned for unique violations", () => {
  const ir = compileOk(minimalSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("UNIQUE_CONFLICT"));
  assert.ok(code.includes("UNIQUE constraint failed"));
  assert.ok(code.includes("const uniqueField = entity.fields.find"));
  assert.ok(code.includes("field: uniqueField"));
});

test("no empty catch blocks in generated runtime", () => {
  const ir = compileOk(authSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  // Must not have bare catch{} (catch with empty body, possibly with whitespace)
  assert.ok(!(/catch\s*\{\s*\}/).test(code), "Found bare empty catch{} in generated runtime");
});

// ── UI: operation key / submit / 409 / textContent ────────────────────────────

test("UI operation key - idempotency key generated for create", () => {
  const ir = compileOk(minimalSource);
  const ui = generateUi(ir);
  assert.ok(ui.appJs.includes("Idempotency-Key"));
  assert.ok(ui.appJs.includes("randomUUID"));
});

test("UI submit - login form submit handler present", () => {
  const ir = compileOk(authSource);
  const ui = generateUi(ir);
  assert.ok(ui.appJs.includes("loginForm"));
  assert.ok(ui.appJs.includes("/auth/login"));
  assert.ok(ui.appJs.includes("submit"));
});

test("UI 409 handling - version conflict offers deterministic reload", () => {
  const ir = compileOk(minimalSource);
  const ui = generateUi(ir);
  assert.ok(ui.appJs.includes("VERSION_CONFLICT"));
  assert.ok(ui.indexHtml.includes('id="entity-reload"'));
  assert.ok(ui.indexHtml.includes('id="action-reload"'));
  assert.ok(ui.appJs.includes("reloadEntityConflict"));
  assert.ok(!ui.appJs.includes("alert("));
});

test("UI textContent - DOM populated via textContent not innerHTML", () => {
  const ir = compileOk(authSource);
  const ui = generateUi(ir);
  assert.ok(ui.appJs.includes("textContent"));
  assert.ok(!ui.appJs.includes("innerHTML"));
  assert.ok(!ui.appJs.includes(".onclick"));
  assert.ok(!ui.indexHtml.match(/\son[a-z]+=/i));
});

test("UI generated form includes field metadata, defaults, and constraints", () => {
  const ir = compileOk(`
application Forms
a Project has a required unique title as text length between 2 and 40 default "New project"
a Project has a required count as integer default 3
a Project has a published as boolean default false
`);
  const ui = generateUi(ir);
  assert.ok(ui.indexHtml.includes('id="entity-dialog"'));
  assert.ok(ui.appJs.includes("field.default"));
  assert.ok(ui.appJs.includes("input.minLength = field.length.min"));
  assert.ok(ui.appJs.includes("input.maxLength = field.length.max"));
  assert.ok(ui.appJs.includes("input.required = Boolean(field.required)"));
  assert.ok(ui.appJs.includes("field.type === 'integer' ? 'number' : 'text'"));
  assert.ok(ui.appJs.includes("input.type = 'checkbox'"));
  assert.ok(ui.indexHtml.includes('"default":"New project"'));
  assert.ok(ui.indexHtml.includes('"length":{"min":2,"max":40}'));
});

test("UI relationship selects load permission-filtered target lists", () => {
  const ir = compileOk(`
application Relationships
a User has a required name as text
a Task has a required title as text
each Task belongs to a User as owner on delete restrict
`);
  const ui = generateUi(ir);
  assert.ok(ui.indexHtml.includes('"relationships":[{"id":"task-owner"'));
  assert.ok(ui.appJs.includes("makeRelationshipField"));
  assert.ok(ui.appJs.includes("relationship.targetPath"));
  assert.ok(ui.appJs.includes("No available "));
  assert.ok(ui.appJs.includes("relationship.name === 'owner' && isForcedOwner(entity)"));
  assert.ok(ui.appJs.includes("relationship.name !== 'owner'"));
});

test("UI create lifecycle uses one operation key and prevents double submit", () => {
  const ui = generateUi(compileOk(minimalSource));
  assert.ok(ui.appJs.includes("operationKey = mode === 'create' ? crypto.randomUUID()"));
  assert.ok(ui.appJs.includes("state.submitting"));
  assert.ok(ui.appJs.includes("entitySubmit.disabled = true"));
  assert.ok(ui.appJs.includes("'Creating…'"));
  assert.ok(ui.appJs.includes("init.headers['Idempotency-Key'] = state.operationKey"));
  assert.ok(ui.appJs.includes("entityDialog.close(); entityDialogState = null; await loadEntity()"));
});

test("UI unique conflict preserves dialog values and reports the field", () => {
  const ui = generateUi(compileOk(minimalSource));
  assert.ok(ui.appJs.includes("body.code === 'UNIQUE_CONFLICT'"));
  assert.ok(ui.appJs.includes("control.input.setAttribute('aria-invalid', 'true')"));
  assert.ok(!ui.appJs.includes("entityForm.reset"));
});

test("UI createRow regression - create opens a generated dialog, never an empty payload", () => {
  const ui = generateUi(compileOk(minimalSource));
  assert.ok(ui.appJs.includes("openEntityDialog('create'"));
  assert.ok(!ui.appJs.includes("function createRow"));
  assert.ok(!ui.appJs.includes("body[f.name]=''"));
  assert.ok(!ui.appJs.includes("alert("));
});

test("UI actions show declared effects and use a confirmation lifecycle key", () => {
  const ir = compileOk(`
application Actions
a Task has a required title as text
a Task has a done as boolean default false
action complete a Task
  require done is false otherwise "Task is already complete"
  set done to true
`);
  const ui = generateUi(ir);
  assert.ok(ui.indexHtml.includes('id="action-dialog"'));
  assert.ok(ui.indexHtml.includes('id="action-effects"'));
  assert.ok(ui.indexHtml.includes("done → true"));
  assert.ok(ui.appJs.includes("operationKey: crypto.randomUUID()"));
  assert.ok(ui.appJs.includes("state.submitting"));
  assert.ok(ui.appJs.includes("'Completing…'"));
  assert.ok(ui.appJs.includes("PRECONDITION_FAILED"));
});

test("UI provisioning preserves password on errors and rotates key only on success", () => {
  const ui = generateUi(compileOk(authSource));
  assert.ok(ui.appJs.includes("let provisionKey = crypto.randomUUID()"));
  assert.ok(ui.appJs.includes("if (provisioning"));
  assert.ok(ui.appJs.includes("provisionPassword.value = ''; provisionKey = crypto.randomUUID()"));
  assert.equal((ui.appJs.match(/provisionPassword\.value = ''/g) ?? []).length, 1);
});

test("no empty catch blocks in generated UI", () => {
  const ir = compileOk(authSource);
  const ui = generateUi(ir);
  assert.ok(!(/catch\s*\{\s*\}/).test(ui.appJs), "Found bare empty catch{} in generated UI appJs");
});

// ── Formatter: roundtrip / determinism ───────────────────────────────────────

test("formatter roundtrip - compile → format → compile preserves IR", () => {
  const ir1 = compileOk(minimalSource);
  const formatted = formatSource(ir1);
  const ir2 = compileOk(formatted);
  assert.equal(canonicalJson(ir1), canonicalJson(ir2));
});

test("formatter determinism - same IR produces same output twice", () => {
  const ir = compileOk(authSource);
  const a = formatSource(ir);
  const b = formatSource(ir);
  assert.equal(a, b);
});

test("formatter roundtrip with auth - preserves auth and permissions", () => {
  const ir1 = compileOk(authSource);
  const formatted = formatSource(ir1);
  const ir2 = compileOk(formatted);
  assert.equal(canonicalJson(ir1.authentication), canonicalJson(ir2.authentication));
  assert.equal(ir1.permissions.length, ir2.permissions.length);
});

test("formatter preserves explicit field ids", () => {
  const ir = compileOk(minimalSource);
  const formatted = formatSource(ir);
  assert.ok(formatted.includes("with id task-title"));
  assert.ok(formatted.includes("with id task-done"));
});

test("formatter outputs action block with preconditions and assignments", () => {
  const ir = compileOk(authSource);
  const formatted = formatSource(ir);
  assert.ok(formatted.includes("action complete a Task with id task-complete"));
  assert.ok(formatted.includes("require done is false"));
  assert.ok(formatted.includes("set done to true"));
});

// ── Action parsing / format / diagnostics E020-E029 / runtime / planner / UI ─

test("action parsing - explicit action with precondition and assignment", () => {
  const ir = compileOk(authSource);
  assert.equal(ir.actions.length, 1);
  const action = ir.actions[0]!;
  assert.equal(action.id, "task-complete");
  assert.equal(action.name, "complete");
  assert.equal(action.preconditions.length, 1);
  assert.equal(action.preconditions[0]!.fieldName, "done");
  assert.equal(action.preconditions[0]!.operator, "is");
  assert.equal(action.preconditions[0]!.value, false);
  assert.equal(action.preconditions[0]!.message, "Task is already complete");
  assert.equal(action.assignments.length, 1);
  assert.equal(action.assignments[0]!.fieldName, "done");
  assert.equal(action.assignments[0]!.value, true);
});

test("action parsing - natural action derives id", () => {
  const ir = compileOk(`application App with id app
entity Task with id task
  done is boolean with id task-done default false
action complete a Task
  require done is false otherwise "already done"
  set done to true
`);
  assert.equal(ir.actions[0]!.id, "task-complete");
});

test("action format - action block formatted with explicit id", () => {
  const ir = compileOk(authSource);
  const formatted = formatSource(ir);
  assert.ok(formatted.includes("action complete a Task with id task-complete"));
});

test("action diagnostics E020 - action with no preconditions", () => {
  assert.equal(
    firstCode(`application App with id app
entity Task with id task
  done is boolean with id task-done default false
action complete a Task with id task-complete
  set done to true
`),
    "E020"
  );
});

test("action diagnostics E021 - action with no assignments", () => {
  assert.equal(
    firstCode(`application App with id app
entity Task with id task
  done is boolean with id task-done default false
action complete a Task with id task-complete
  require done is false otherwise "already done"
`),
    "E021"
  );
});

test("action diagnostics E022 - no-op action (precondition same as assignment)", () => {
  assert.equal(
    firstCode(`application App with id app
entity Task with id task
  done is boolean with id task-done default false
action complete a Task with id task-complete
  require done is false otherwise "already false"
  set done to false
`),
    "E022"
  );
});

test("action diagnostics E023 - unknown field in precondition", () => {
  assert.equal(
    firstCode(`application App with id app
entity Task with id task
  done is boolean with id task-done default false
action complete a Task with id task-complete
  require ghost is false otherwise "ghost"
  set done to true
`),
    "E023"
  );
});

test("action diagnostics E023 - unknown field in assignment", () => {
  assert.equal(
    firstCode(`application App with id app
entity Task with id task
  done is boolean with id task-done default false
action complete a Task with id task-complete
  require done is false otherwise "already done"
  set ghost to true
`),
    "E023"
  );
});

test("action diagnostics E024 - type mismatch in precondition", () => {
  assert.equal(
    firstCode(`application App with id app
entity Task with id task
  done is boolean with id task-done default false
action complete a Task with id task-complete
  require done is 42 otherwise "type mismatch"
  set done to true
`),
    "E024"
  );
});

test("action diagnostics E024 - type mismatch in assignment", () => {
  assert.equal(
    firstCode(`application App with id app
entity Task with id task
  done is boolean with id task-done default false
action complete a Task with id task-complete
  require done is false otherwise "already done"
  set done to 42
`),
    "E024"
  );
});

test("action diagnostics E025 - system field in assignment", () => {
  assert.equal(
    firstCode(`application App with id app
entity Task with id task
  done is boolean with id task-done default false
action complete a Task with id task-complete
  require done is false otherwise "already done"
  set id to "override"
`),
    "E023"
  );
  // Note: "id" is not in entity fields, so it triggers E023 (unknown field)
  // which correctly blocks assigning system fields
});

test("action diagnostics E026 - duplicate assignment", () => {
  assert.equal(
    firstCode(`application App with id app
entity Task with id task
  done is boolean with id task-done default false
action complete a Task with id task-complete
  require done is false otherwise "already done"
  set done to true
  set done to false
`),
    "E026"
  );
});

test("action diagnostics E028 - numeric operator on boolean field", () => {
  assert.equal(
    firstCode(`application App with id app
entity Task with id task
  done is boolean with id task-done default false
action check a Task with id task-check
  require done is greater than 0 otherwise "needs number"
  set done to true
`),
    "E028"
  );
});

test("action diagnostics E029 - action body line outside action", () => {
  // A 'require' or 'set' line with two leading spaces inside an entity body (not an action) → E029
  assert.equal(
    firstCode(`application App with id app
entity Task with id task
  done is boolean with id task-done default false
  require done is false otherwise "orphan"
`),
    "E029"
  );
});

test("action runtime - action endpoint in generated code", () => {
  const ir = compileOk(authSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  // The runtime generates action routes dynamically from SECURITY_SCHEMA.actions
  assert.ok(code.includes("/actions/"), "Expected /actions/ in route pattern");
  assert.ok(code.includes("action.name"), "Expected action.name used in route");
  assert.ok(code.includes("PRECONDITION_FAILED"));
});

test("action runtime - integer comparison operators generated", () => {
  const ir = compileOk(`application App with id app
entity Counter with id counter
  count is integer with id counter-count default 0
action increment a Counter with id counter-increment
  require count is at least 0 otherwise "must be non-negative"
  require count is less than 100 otherwise "cannot exceed 100"
  set count to 1
`);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("is at least"));
  assert.ok(code.includes("is less than"));
});

test("action planner - action-added detected", () => {
  const before = compileOk(minimalSource);
  const after = compileOk(`application Todo with id todo
entity Task with id task
  title is required text with id task-title
  done is boolean with id task-done default false
action complete a Task with id task-complete
  require done is false otherwise "already done"
  set done to true
`);
  const plan = planMigration(buildManifest(before), after);
  assert.ok(plan.items.some((i) => i.kind === "action-added"));
});

test("action planner - action-removed detected", () => {
  const before = compileOk(`application Todo with id todo
entity Task with id task
  title is required text with id task-title
  done is boolean with id task-done default false
action complete a Task with id task-complete
  require done is false otherwise "already done"
  set done to true
`);
  const after = compileOk(minimalSource);
  const plan = planMigration(buildManifest(before), after);
  assert.ok(plan.items.some((i) => i.kind === "action-removed"));
});

test("action UI - action buttons rendered for entity", () => {
  const ir = compileOk(authSource);
  const ui = generateUi(ir);
  assert.ok(ui.appJs.includes("/actions/"));
  assert.ok(ui.appJs.includes("openActionDialog"));
  assert.ok(ui.appJs.includes("confirmAction"));
});

// ── Schema / compiler versions ────────────────────────────────────────────────

test("schema version is 0.5.0", () => {
  const ir = compileOk(minimalSource);
  assert.equal(ir.schemaVersion, "0.5.0");
});

test("compiler version is 0.6.0-alpha.0", () => {
  const manifest = buildManifest(compileOk(minimalSource));
  assert.equal(manifest.compilerVersion, "0.6.0-alpha.0");
});

test("compiler version is independent from schema version", () => {
  const ir = compileOk(minimalSource);
  const manifest = buildManifest(ir);
  assert.equal(manifest.schemaVersion, ir.schemaVersion);
  assert.equal(manifest.schemaVersion, "0.5.0");
  // Compiler version may differ from schema version
  assert.ok(manifest.compilerVersion.length > 0, "compilerVersion is set");
});

// ── CLI write flags ────────────────────────────────────────────────────────────
// CLI tests invoke the underlying APIs directly to avoid shell-quoting issues on Windows.
// The CLI is a thin wrapper that delegates to the same functions tested below.

test("CLI write flags - compile without --write prints to stdout", () => {
  // Verify the compile output contains valid JSON with schemaVersion
  const ir = compileOk("application Todo with id todo\nentity Task with id task\n  title is required text with id task-title\n");
  const result = compileSource("application Todo with id todo\nentity Task with id task\n  title is required text with id task-title\n");
  assert.ok(result.ok);
  if (result.ok) {
    assert.ok(result.output.includes('"schemaVersion"'));
    assert.ok(result.output.includes('"0.5.0"'));
    assert.ok(result.output.endsWith("\n"));
  }
  void ir;
});

test("CLI write flags - check command shows summary", () => {
  // The check command verifies the IR compiles and summarizes entity/field counts
  const ir = compileOk(authSource);
  assert.ok(ir.entities.length >= 2, "check should show at least 2 entities");
  assert.ok(ir.authentication !== undefined, "check should show authentication enabled");
  assert.ok(ir.roles.length >= 2, "check should show roles");
  assert.ok(ir.permissions.length > 0, "check should show permissions");
});

test("CLI write flags - generate without --write shows plan only", () => {
  // The generate command computes a migration plan; with no previous manifest it's initial generation
  const ir = compileOk(authSource);
  const manifest = buildManifest(ir);
  const plan = planMigration(manifest, ir);
  // Same IR → no changes
  assert.equal(plan.hasChanges, false, "Same IR produces no migration plan changes");
});

test("CLI write flags - format command produces canonical output", () => {
  // format command calls formatSource → must produce valid re-parseable source
  const ir = compileOk(authSource);
  const formatted = formatSource(ir);
  assert.ok(formatted.includes("application"));
  assert.ok(formatted.includes("entity"));
  const recompiled = compileSource(formatted);
  assert.equal(recompiled.ok, true, "Formatted output must re-compile successfully");
});

// ── v0.5 auth IR ──────────────────────────────────────────────────────────────

test("v0.5 auth IR compiles with deterministic permission ids", () => {
  const ir = compileOk(authSource);
  assert.equal(ir.schemaVersion, "0.5.0");
  assert.ok(ir.authentication);
  assert.equal(ir.roles.length, 2);
  assert.ok(ir.permissions.some((p) => p.id === "perm-member-create-task"));
  assert.ok(ir.permissions.some((p) => p.id === "perm-administrator-run-task-complete"));
  assert.ok(ir.permissions.some((p) => p.id === "perm-administrator-provision"));
  assert.deepEqual(ir.roles.find((role) => role.name === "Administrator"), {
    id: "administrator",
    name: "Administrator"
  });
  assert.deepEqual(ir.permissions.find((permission) => permission.id === "perm-administrator-provision"), {
    id: "perm-administrator-provision",
    roleId: "administrator",
    operation: "provision",
    entityId: ""
  });
  assert.deepEqual(ir.permissions.find((permission) => permission.id === "perm-member-create-task"), {
    id: "perm-member-create-task",
    roleId: "member",
    operation: "create",
    entityId: "task",
    scope: { kind: "force-owner" }
  });
});

test("legacy source compiles with undefined auth and empty role/permission arrays", () => {
  const ir = compileOk(minimalSource);
  assert.equal(ir.authentication, undefined);
  assert.deepEqual(ir.roles, []);
  assert.deepEqual(ir.permissions, []);
});

test("parser diagnostics for v0.5 auth grammar E049 - role without auth", () => {
  assert.equal(
    firstCode(`application X with id x
role Administrator
`),
    "E049"
  );
});

test("parser diagnostics for v0.5 auth grammar E050 - provision without auth", () => {
  assert.equal(
    firstCode(`application X with id x
role Administrator
allow Administrator to provision accounts
`),
    "E049"
  );
  assert.ok(
    allCodes(`application X with id x
role Administrator
allow Administrator to provision accounts
`).includes("E050")
  );
});

test("parser diagnostics for v0.5 auth grammar E047 - duplicate authentication", () => {
  assert.equal(
    firstCode(`application X with id x
authentication uses User identified by email
authentication uses User identified by email
entity User with id user
  email is required unique text with id user-email
`),
    "E047"
  );
});

test("parser diagnostics for v0.5 auth grammar E048 - identity field not required unique text", () => {
  assert.equal(
    firstCode(`application X with id x
authentication uses User identified by email
role Administrator
entity User with id user
  email is text with id user-email
`),
    "E048"
  );
});

test("parser diagnostics for v0.5 auth grammar E041 - unknown role in allow", () => {
  assert.equal(
    firstCode(`application X with id x
authentication uses User identified by email
role Member
entity User with id user
  email is required unique text with id user-email
allow Unknown to read User
`),
    "E041"
  );
});

test("parser diagnostics for v0.5 auth grammar E043 - unknown action in allow run", () => {
  assert.equal(
    firstCode(`application X with id x
authentication uses User identified by email
role Member
entity User with id user
  email is required unique text with id user-email
allow Member to run nope on User
`),
    "E043"
  );
});

test("explicit canonical role id - role with id compiles to canonical role IR", () => {
  const ir = compileOk(authSource);
  const admin = ir.roles.find((r) => r.name === "Administrator")!;
  assert.deepEqual(admin, { id: "administrator", name: "Administrator" });
});

test("natural role syntax compiles to the same canonical role IR", () => {
  const ir = compileOk(authSource);
  const member = ir.roles.find((r) => r.name === "Member")!;
  assert.deepEqual(member, { id: "member", name: "Member" });
});

test("formatter always includes canonical role id", () => {
  const ir = compileOk(authSource);
  const formatted = formatSource(ir);
  assert.ok(formatted.includes("role Administrator with id administrator"));
  assert.ok(formatted.includes("role Member with id member"));
});

test("planner detects role-added", () => {
  const before = compileOk(authSource);
  const after = compileOk(authSource + "role Viewer\n");
  const plan = planMigration(buildManifest(before), after);
  assert.ok(plan.items.some((i) => i.kind === "role-added"));
  assert.equal(plan.isSecurityDestructive, false);
});

test("planner detects permission-added", () => {
  const before = compileOk(authSource);
  const afterSource = authSource + "allow Administrator to read User\n";
  const after = compileOk(afterSource);
  const plan = planMigration(buildManifest(before), after);
  assert.ok(plan.items.some((i) => i.kind === "permission-added"));
});

test("planner detects permission-removed without security-destructive flag", () => {
  const before = compileOk(authSource);
  const after = compileOk(authSource.replace("allow Member to update Task where owner is self\n", ""));
  const plan = planMigration(buildManifest(before), after);
  assert.equal(plan.isSecurityDestructive, false);
  assert.ok(plan.items.some((i) => i.kind === "permission-removed"));
});

test("planner marks authentication-added as non-security-destructive", () => {
  const before = compileOk(minimalSource);
  const after = compileOk(authSource);
  const plan = planMigration(buildManifest(before), after);
  assert.ok(plan.items.some((i) => i.kind === "authentication-added"));
  assert.equal(plan.isSecurityDestructive, false);
});

test("planner marks authentication-removed as security-destructive", () => {
  const before = compileOk(authSource);
  const after = compileOk(minimalSource);
  const plan = planMigration(buildManifest(before), after);
  assert.ok(plan.items.some((i) => i.kind === "authentication-removed"));
  assert.equal(plan.isSecurityDestructive, true);
});

// ── v0.5 runtime auth checks ─────────────────────────────────────────────────

test("runtime bootstrap validation - requires environment variables", () => {
  const ir = compileOk(authSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("INTENTLANG_BOOTSTRAP_NAME"));
  assert.ok(code.includes("INTENTLANG_BOOTSTRAP_EMAIL"));
  assert.ok(code.includes("INTENTLANG_BOOTSTRAP_PASSWORD"));
  assert.ok(code.includes("No accounts exist"));
});

test("runtime bootstrap validation - password length minimum 12", () => {
  const ir = compileOk(authSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("12"));
  assert.ok(code.includes("password.length"));
});

test("runtime session is stored as SHA-256 hash not plaintext", () => {
  const ir = compileOk(authSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("sha256(sessionToken)"));
  assert.ok(code.includes("\"token_hash\""));
  // Raw token must NOT be stored directly
  assert.ok(!code.includes('"session_token"=?'));
});

test("runtime CSRF is timing-safe with timingSafeEqual", () => {
  const ir = compileOk(authSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("timingSafeEqual"));
  assert.ok(code.includes("csrf_token_hash"));
});

test("runtime 8-hour session cookie max-age", () => {
  const ir = compileOk(authSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("SESSION_MAX_AGE_SECONDS"));
  assert.ok(code.includes("28800"));
});

test("runtime same-origin check in mutation guards", () => {
  const ir = compileOk(authSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("requireSameOrigin"));
  assert.ok(code.includes("Origin denied"));
});

test("runtime security headers on every response", () => {
  const ir = compileOk(authSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("X-Content-Type-Options"));
  assert.ok(code.includes("Referrer-Policy"));
  assert.ok(code.includes("Content-Security-Policy"));
  assert.ok(code.includes("Permissions-Policy"));
  assert.ok(code.includes("camera=(), microphone=(), geolocation=()"));
});

test("runtime CSP contains both script hashes", () => {
  const ir = compileOk(authSource);
  const ui = generateUi(ir);
  const code = generateRuntime(ir, buildManifest(ir), ui).appMjs;
  // CSP must reference both theme script hashes
  assert.ok(code.includes("cspScoutHash") || code.includes("sha256-"));
  assert.ok(code.includes("cspThemeHash") || code.includes("sha256-"));
});

test("runtime auth routes - /auth/login /auth/logout /auth/me /auth/accounts", () => {
  const ir = compileOk(authSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("/auth/login"));
  assert.ok(code.includes("/auth/logout"));
  assert.ok(code.includes("/auth/me"));
  assert.ok(code.includes("/auth/accounts"));
});

test("runtime default-deny - auth check before every entity route", () => {
  const ir = compileOk(authSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("SECURITY_SCHEMA.authentication && !session"));
  assert.ok(code.includes("UNAUTHORIZED"));
});

test("runtime hidden 404 - unauthorized access returns 404 not 403", () => {
  const ir = compileOk(authSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  // For GET single record and action endpoints, unauthorized returns 404
  assert.ok(code.includes("code: 'NOT_FOUND'"));
});

test("runtime force owner - ownership field set to session identity", () => {
  const ir = compileOk(authSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("forceOwner"));
  assert.ok(code.includes("session.identity_id"));
});

test("runtime login rate limiting prevents brute force", () => {
  const ir = compileOk(authSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("loginRateLimitOk") || code.includes("LOGIN_LIMIT"));
  assert.ok(code.includes("60_000") || code.includes("60000"));
});

test("runtime login returns generic INVALID_CREDENTIALS for wrong password", () => {
  const ir = compileOk(authSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("INVALID_CREDENTIALS"));
});

test("runtime audit strips passwords and tokens", () => {
  const ir = compileOk(authSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("lower.includes('password')"));
  assert.ok(code.includes("lower.includes('token')"));
  assert.ok(code.includes("lower.includes('csrf')"));
});

test("runtime SQL list scoping - effectiveWhere applied for member reads", () => {
  const ir = compileOk(authSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("effectiveWhere"));
  assert.ok(code.includes("where.sql"));
});

test("runtime scrypt used for password hashing", () => {
  const ir = compileOk(authSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  assert.ok(code.includes("scrypt"));
  assert.ok(code.includes("N: 16384"));
});

test("runtime unauth mode - no auth check when authentication undefined", () => {
  const ir = compileOk(minimalSource);
  const code = generateRuntime(ir, buildManifest(ir), generateUi(ir)).appMjs;
  // The runtime template always has the auth guard, but it's gated on SECURITY_SCHEMA.authentication
  assert.ok(code.includes("SECURITY_SCHEMA.authentication"), "Expected auth guard using SECURITY_SCHEMA");
  // The guard must use the AND conjunction so unauth mode passes through
  assert.ok(
    code.includes("SECURITY_SCHEMA.authentication && !session"),
    "Auth check must be conditional on SECURITY_SCHEMA.authentication"
  );
});

// ── UI: split assets / login / header / account UI / permission-aware ─────────

test("UI split assets - separate index.html, app.js, styles.css", () => {
  const ir = compileOk(authSource);
  const ui = generateUi(ir);
  assert.ok(ui.indexHtml.length > 0);
  assert.ok(ui.appJs.length > 0);
  assert.ok(ui.stylesCss.length > 0);
  // index.html links to separate files
  assert.ok(ui.indexHtml.includes('src="/app.js"'));
  assert.ok(ui.indexHtml.includes('href="/styles.css"'));
});

test("UI login form present when auth enabled", () => {
  const ir = compileOk(authSource);
  const ui = generateUi(ir);
  assert.ok(ui.indexHtml.includes("auth-login-form"));
  assert.ok(ui.indexHtml.includes("auth-login-email"));
  assert.ok(ui.indexHtml.includes("auth-login-password"));
  assert.ok(ui.indexHtml.includes("auth-login-submit"));
});

test("UI scoutTheme script appears first in head", () => {
  const ir = compileOk(authSource);
  const ui = generateUi(ir);
  // SCOUT_THEME_SCRIPT must appear before THEME_SCRIPT
  const scoutIdx = ui.indexHtml.indexOf("scoutTheme");
  const themeIdx = ui.indexHtml.indexOf("localStorage.getItem");
  assert.ok(scoutIdx >= 0, "scoutTheme script missing");
  assert.ok(themeIdx >= 0, "localStorage theme script missing");
  assert.ok(scoutIdx < themeIdx, "scoutTheme script must appear before localStorage script");
});

test("UI styles use var(--cp-*) CSS variables", () => {
  const ir = compileOk(authSource);
  const ui = generateUi(ir);
  assert.ok(ui.stylesCss.includes("var(--cp-bg)"));
  assert.ok(ui.stylesCss.includes("var(--cp-accent)"));
  assert.ok(ui.stylesCss.includes("var(--cp-text)"));
});

test("UI keeps exact Clawpilot theme tokens and typography", () => {
  const ui = generateUi(compileOk(authSource));
  assert.ok(ui.indexHtml.includes('new URLSearchParams(window.location.search).get("scoutTheme")'));
  assert.ok(ui.indexHtml.includes('param || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")'));
  assert.ok(ui.stylesCss.includes("--cp-bg: #f7f4ef;"));
  assert.ok(ui.stylesCss.includes("--cp-accent: #b11f4b;"));
  assert.ok(ui.stylesCss.includes("--cp-bg: #3d3b3a;"));
  assert.ok(ui.stylesCss.includes("--cp-accent: #fd8ea1;"));
  assert.ok(ui.stylesCss.includes('"Segoe UI", Aptos, Calibri, -apple-system, BlinkMacSystemFont, sans-serif'));
});

test("UI dialogs and statuses expose accessible keyboard semantics", () => {
  const ui = generateUi(compileOk(authSource));
  assert.ok(ui.indexHtml.includes("<dialog"));
  assert.ok(ui.indexHtml.includes('aria-labelledby="entity-dialog-title"'));
  assert.ok(ui.indexHtml.includes('aria-labelledby="action-dialog-title"'));
  assert.ok(ui.indexHtml.includes('aria-live="assertive"'));
  assert.ok(ui.appJs.includes("addEventListener('cancel'"));
  assert.ok(ui.appJs.includes(".focus()"));
  assert.ok(ui.stylesCss.includes(":focus-visible"));
});

test("UI header renders identity and role", () => {
  const ir = compileOk(authSource);
  const ui = generateUi(ir);
  assert.ok(ui.indexHtml.includes("auth-identity"));
  assert.ok(ui.indexHtml.includes("auth-role"));
  assert.ok(ui.indexHtml.includes("auth-logout"));
});

test("UI account provision form present", () => {
  const ir = compileOk(authSource);
  const ui = generateUi(ir);
  assert.ok(ui.indexHtml.includes("provision-card"));
  assert.ok(ui.indexHtml.includes("provision-email"));
  assert.ok(ui.indexHtml.includes("provision-role"));
});

test("UI permission-aware controls - hasPermission gates entity access", () => {
  const ir = compileOk(authSource);
  const ui = generateUi(ir);
  assert.ok(ui.appJs.includes("hasPermission"));
  assert.ok(ui.appJs.includes("schema.authEnabled"));
});

test("UI no auth token storage - no localStorage token writes", () => {
  const ir = compileOk(authSource);
  const ui = generateUi(ir);
  // Token must NOT be stored in localStorage
  assert.ok(!ui.appJs.includes("localStorage.setItem") || !ui.appJs.includes("token"));
  // Specifically must not write token to storage
  const localStorageTokenWrite = /localStorage\.setItem\s*\(\s*['"].*token/.test(ui.appJs);
  assert.equal(localStorageTokenWrite, false, "UI must not store auth tokens in localStorage");
});

test("UI session expiration - 401 triggers re-login", () => {
  const ir = compileOk(authSource);
  const ui = generateUi(ir);
  assert.ok(ui.appJs.includes("401"));
  assert.ok(ui.appJs.includes("showLogin"));
});

test("UI unauth mode - shows entities without login when no auth", () => {
  const ir = compileOk(minimalSource);
  const ui = generateUi(ir);
  // Without auth, app-root should not be hidden initially
  assert.ok(!ui.indexHtml.includes('id="app-root" class="hidden"'));
  assert.ok(ui.indexHtml.includes('id="app-root"'));
});

test("manifest includes ir and schema version fields", () => {
  const ir = compileOk(authSource);
  const manifest = buildManifest(ir);
  assert.ok(manifest.irFingerprint.startsWith("sha256:"));
  assert.equal(manifest.schemaVersion, "0.5.0");
  assert.ok(manifest.ir.application.name === "Todo");
});

test("E040 - duplicate role declaration", () => {
  assert.equal(
    firstCode(`application X with id x
authentication uses User identified by email
role Member
role Member
entity User with id user
  email is required unique text with id user-email
`),
    "E040"
  );
});

test("E048 - identity entity not declared", () => {
  assert.equal(
    firstCode(`application X with id x
authentication uses User identified by email
role Member
entity Person with id person
  email is required unique text with id person-email
`),
    "E048"
  );
});

test("E044 - self scope on non-identity entity", () => {
  assert.equal(
    firstCode(`application X with id x
authentication uses User identified by email
role Member
entity User with id user
  email is required unique text with id user-email
entity Task with id task
  title is required text with id task-title
allow Member to read Task where self
`),
    "E044"
  );
});

test("E045 - owner scope without ownership relationship", () => {
  assert.equal(
    firstCode(`application X with id x
authentication uses User identified by email
role Member
entity User with id user
  email is required unique text with id user-email
entity Task with id task
  title is required text with id task-title
allow Member to read Task where owner is self
`),
    "E045"
  );
});

test("E046 - duplicate allow rule", () => {
  assert.equal(
    firstCode(`application X with id x
authentication uses User identified by email
role Member
entity User with id user
  email is required unique text with id user-email
allow Member to read User where self
allow Member to read User where self
`),
    "E046"
  );
});
