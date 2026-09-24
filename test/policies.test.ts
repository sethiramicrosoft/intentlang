import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, compileSource, formatSource } from "../src/compiler.js";
import { expandPolicySource } from "../src/language/policies.js";
import { buildManifest } from "../src/manifest.js";
import type { BuildManifest } from "../src/model.js";

const abstractSource = `application Policies
authentication uses User identified by email
role Administrator
role Contributor
role Manager extends Contributor

a User has a required unique email as text
a Task has a required title as text
each Task belongs to a User as owner on delete restrict

policy OwnedTask
  allow to create Task with owner as self
  allow to read Task where owner is self
  allow to update Task where owner is self

grant OwnedTask to Contributor
allow Administrator to provision accounts
`;

test("policies and inheritance expand to explicit permissions", () => {
  const expanded = expandPolicySource(abstractSource);
  assert.equal(expanded.ok, true);
  if (!expanded.ok) return;
  assert.ok(expanded.source.includes("allow Contributor to read Task where owner is self"));
  assert.ok(expanded.source.includes("allow Manager to read Task where owner is self"));
  assert.equal(expanded.expansions.length, 2);

  const result = compileSource(abstractSource);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.ir.permissions.length, 7);
  const canonical = formatSource(result.ir);
  assert.ok(!canonical.includes("policy "));
  assert.ok(!canonical.includes("extends "));
  assert.ok(canonical.includes("allow Manager to update Task where owner is self"));
});

test("abstract and explicit policy programs have identical semantics", () => {
  const abstract = compileSource(abstractSource);
  assert.equal(abstract.ok, true);
  if (!abstract.ok) return;
  const explicit = compileSource(formatSource(abstract.ir));
  assert.equal(explicit.ok, true);
  if (!explicit.ok) return;
  assert.equal(canonicalJson(abstract.ir), canonicalJson(explicit.ir));
});

test("policy graph errors are explicit", () => {
  for (const [source, code] of [
    ["application X\nrole A extends B\nrole B extends A\n", "E054"],
    ["application X\nrole A\ngrant Missing to A\n", "E055"],
    ["application X\nrole A extends Missing\n", "E053"],
    ["application X\npolicy Empty\nrole A\n", "E052"]
  ] as const) {
    const result = compileSource(source);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.diagnostics.some((item) => item.code === code));
  }
});

test("run-all policy macros reject entities without actions", () => {
  const result = compileSource(`application EmptyActions
an User has a required unique email as text
an Item has a required name as text
authentication uses User identified by email
role Member
policy ItemActions
  allow to run all actions on Item
grant ItemActions to Member
`);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      result.diagnostics.map((diagnostic) => diagnostic.code),
      ["E052"]
    );
  }
});

test("LaunchOps policies reduce permission source by at least 60 percent without semantic drift", async () => {
  const source = await readFile("examples/launch-ops.intent", "utf8");
  const previous = JSON.parse(
    await readFile(
      "examples/launch-ops-generated/intentlang.manifest.json",
      "utf8"
    )
  ) as BuildManifest;
  const result = compileSource(source);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.ir.permissions.length, 95);
  assert.equal(buildManifest(result.ir).semanticFingerprint, previous.irFingerprint);
  assert.equal(canonicalJson(result.ir), canonicalJson(previous.ir));

  const authoredPolicyLines = source
    .split(/\r?\n/)
    .filter((line) =>
      /^(?:policy |grant |\s{2}allow to )/.test(line)
    ).length;
  assert.ok(
    authoredPolicyLines <= 38,
    `Expected at least 60% reduction from 95 lines, got ${authoredPolicyLines}`
  );
});
