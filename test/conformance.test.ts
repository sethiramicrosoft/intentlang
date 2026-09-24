import assert from "node:assert/strict";
import test from "node:test";
import { compileSource, formatSource } from "../src/compiler.js";
import { generateSchema } from "../src/generator.js";
import { loadConformanceFixtures } from "../src/language/conformance.js";
import { buildManifest } from "../src/manifest.js";
import { generateRuntime } from "../src/runtime-codegen.js";
import { generateUi } from "../src/ui-codegen.js";
import { compileVisualSource } from "../src/visual.js";
import { compilePageSource } from "../src/web.js";

test("conformance loader discovers categorized fixtures with unique IDs", async () => {
  const fixtures = await loadConformanceFixtures();
  assert.ok(fixtures.length >= 30);
  assert.equal(
    new Set(fixtures.map(({ fixture }) => fixture.id)).size,
    fixtures.length
  );
});

test("all business valid and invalid fixtures match compiler outcomes", async () => {
  const fixtures = await loadConformanceFixtures();
  const businessFixtures = fixtures.filter(
    ({ fixture }) =>
      (fixture.category === "valid" || fixture.category === "invalid") &&
      !fixture.ruleIds.some(
        (id) => id.startsWith("VIS-") || id.startsWith("PAGE-")
      )
  );
  for (const { fixture } of businessFixtures) {
    const result = compileSource(fixture.source);
    const expected = fixture.expected as {
      ok: boolean;
      diagnosticCodes?: string[];
    };
    assert.equal(result.ok, expected.ok, fixture.id);
    if (!result.ok) {
      assert.deepEqual(
        result.diagnostics.map(({ code }) => code),
        expected.diagnosticCodes,
        fixture.id
      );
    }
  }
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

test("all visual valid and invalid fixtures match compiler outcomes", async () => {
  const fixtures = await loadConformanceFixtures();
  const visualFixtures = fixtures.filter(
    ({ fixture }) =>
      (fixture.category === "valid" ||
        fixture.category === "invalid" ||
        fixture.category === "ambiguous") &&
      fixture.ruleIds.some((id) => id.startsWith("VIS-"))
  );
  for (const { fixture } of visualFixtures) {
    const result = compileVisualSource(fixture.source);
    const expected = fixture.expected as {
      ok: boolean;
      diagnosticCodes?: string[];
    };
    assert.equal(result.ok, expected.ok, fixture.id);
    if (!result.ok) {
      assert.deepEqual(
        result.diagnostics.map(({ code }) => code),
        expected.diagnosticCodes,
        fixture.id
      );
    }
  }
});

test("page fixtures prove structure, events, ambiguity, and safe runtime output", async () => {
  const fixtures = await loadConformanceFixtures();
  const pageFixtures = fixtures.filter(({ fixture }) =>
    fixture.ruleIds.some((id) => id.startsWith("PAGE-"))
  );
  for (const { fixture } of pageFixtures) {
    const result = compilePageSource(fixture.source);
    const expected = fixture.expected as {
      ok?: boolean;
      diagnosticCodes?: string[];
      htmlContains?: string[];
      htmlExcludes?: string[];
    };
    if (fixture.category === "runtime") {
      assert.equal(result.ok, true, fixture.id);
      if (!result.ok) continue;
      for (const text of expected.htmlContains ?? []) {
        assert.ok(result.html.includes(text), `${fixture.id} is missing ${text}`);
      }
      for (const text of expected.htmlExcludes ?? []) {
        assert.ok(!result.html.includes(text), `${fixture.id} contains ${text}`);
      }
      continue;
    }

    assert.equal(result.ok, expected.ok, fixture.id);
    if (!result.ok) {
      assert.deepEqual(
        [...new Set(result.diagnostics.map(({ code }) => code))],
        expected.diagnosticCodes,
        fixture.id
      );
    }
  }
});

test("runtime fixture proves synchronized secured workflow generation", async () => {
  const fixtures = await loadConformanceFixtures();
  const fixture = fixtures.find(
    ({ fixture }) => fixture.id === "secured-workflow-runtime"
  )!.fixture;
  const result = compileSource(fixture.source);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const schema = generateSchema(result.ir).migrationSql;
  const ui = generateUi(result.ir);
  const runtime = generateRuntime(result.ir, buildManifest(result.ir), ui).appMjs;
  const expected = fixture.expected as {
    schemaContains: string[];
    runtimeContains: string[];
    uiContains: string[];
  };
  for (const text of expected.schemaContains) {
    assert.ok(schema.includes(text), `Schema is missing ${text}`);
  }
  for (const text of expected.runtimeContains) {
    assert.ok(runtime.includes(text), `Runtime is missing ${text}`);
  }
  for (const text of expected.uiContains) {
    assert.ok(
      ui.appJs.includes(text) || ui.indexHtml.includes(text),
      `UI is missing ${text}`
    );
  }
});
