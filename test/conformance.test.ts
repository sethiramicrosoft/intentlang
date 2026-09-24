import assert from "node:assert/strict";
import test from "node:test";
import { compileSource, formatSource } from "../src/compiler.js";
import { loadConformanceFixtures } from "../src/language/conformance.js";
import { compileVisualSource } from "../src/visual.js";

test("conformance loader discovers categorized fixtures with unique IDs", async () => {
  const fixtures = await loadConformanceFixtures();
  assert.equal(fixtures.length, 6);
  assert.equal(
    new Set(fixtures.map(({ fixture }) => fixture.id)).size,
    fixtures.length
  );
});

test("initial business conformance fixtures match compiler behavior", async () => {
  const fixtures = await loadConformanceFixtures();
  const valid = fixtures.find(
    ({ fixture }) => fixture.id === "business-core-valid"
  )!.fixture;
  assert.equal(compileSource(valid.source).ok, true);

  const invalid = fixtures.find(
    ({ fixture }) => fixture.id === "missing-application-invalid"
  )!.fixture;
  const result = compileSource(invalid.source);
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.ok ? [] : result.diagnostics.map(({ code }) => code),
    ["E004"]
  );

  const canonical = fixtures.find(
    ({ fixture }) => fixture.id === "natural-application-canonical"
  )!.fixture;
  const canonicalResult = compileSource(canonical.source);
  assert.equal(canonicalResult.ok, true);
  if (!canonicalResult.ok) return;
  assert.equal(
    formatSource(canonicalResult.ir),
    (canonical.expected as { canonicalSource: string }).canonicalSource
  );
});

test("initial visual conformance fixtures reject unknown and ambiguous meaning", async () => {
  const fixtures = await loadConformanceFixtures();
  for (const id of ["visual-unknown-invalid", "visual-it-ambiguous"]) {
    const fixture = fixtures.find(({ fixture }) => fixture.id === id)!.fixture;
    const result = compileVisualSource(fixture.source);
    assert.equal(result.ok, false);
    assert.deepEqual(
      result.ok ? [] : result.diagnostics.map(({ code }) => code),
      (fixture.expected as { diagnosticCodes: string[] }).diagnosticCodes
    );
  }
});
