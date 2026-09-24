import assert from "node:assert/strict";
import test from "node:test";
import { compileSource } from "../src/compiler.js";
import { loadConformanceFixtures } from "../src/language/conformance.js";
import { classifyCompatibility } from "../src/language/compatibility.js";
import { buildSemanticManifest } from "../src/language/semantic-fingerprint.js";
import { COMPILER_VERSION } from "../src/manifest.js";

function manifest(source: string) {
  const result = compileSource(source);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("compile failed");
  return buildSemanticManifest(result.ir, COMPILER_VERSION);
}

test("compatibility classifies identical and semantic changes", () => {
  const before = manifest("application Todo\na Task has a done as boolean default false\n");
  const same = manifest("application Todo with id todo\nentity Task with id task\n  done is boolean with id task-done default false\n");
  const changed = manifest("application Todo\na Task has a done as boolean default true\n");
  assert.equal(classifyCompatibility(before, same).classification, "identical");
  assert.equal(classifyCompatibility(before, changed).classification, "semantic-change");
});

test("compatibility requires review for dependency and generator changes", () => {
  const base = manifest("application Todo\na Task has a required title as text\n");
  const dependency = {
    ...base,
    dependencyFingerprint: "sha256:changed"
  };
  const generator = {
    ...base,
    generatorVersions: { ...base.generatorVersions, ui: "next" }
  };
  assert.equal(
    classifyCompatibility(base, dependency).classification,
    "dependency-change"
  );
  assert.equal(
    classifyCompatibility(base, generator).classification,
    "generator-change"
  );
});

test("historical compatibility fixture preserves canonical meaning", async () => {
  const fixtures = await loadConformanceFixtures();
  const fixture = fixtures.find(
    ({ fixture }) => fixture.id === "business-core-compatibility"
  )!.fixture;
  const expected = fixture.expected as {
    canonicalSource: string;
    equivalentSource: string;
    changedSource: string;
  };
  const baseline = manifest(fixture.source);
  const equivalent = manifest(expected.equivalentSource);
  const changed = manifest(expected.changedSource);

  const canonicalResult = compileSource(fixture.source);
  assert.equal(canonicalResult.ok, true);
  if (!canonicalResult.ok) return;
  const canonicalManifest = buildSemanticManifest(
    canonicalResult.ir,
    COMPILER_VERSION
  );
  assert.equal(canonicalManifest.sourceFingerprint, baseline.sourceFingerprint);
  assert.equal(
    classifyCompatibility(baseline, equivalent).classification,
    "identical"
  );
  assert.equal(
    classifyCompatibility(baseline, changed).classification,
    "semantic-change"
  );
  assert.ok(expected.canonicalSource.includes("application Todo with id todo"));
});
