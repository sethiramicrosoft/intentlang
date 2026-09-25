import { compileSource, formatSource } from "../compiler.js";
import { generateSchema } from "../generator.js";
import { buildManifest } from "../manifest.js";
import { generateRuntime } from "../runtime-codegen.js";
import { generateUi } from "../ui-codegen.js";
import { compileVisualSource } from "../visual.js";
import { compilePageSource } from "../web.js";
import { resolveIntent } from "./intent-resolution.js";
import {
  loadConformanceFixtures,
  type LoadedConformanceFixture
} from "./conformance.js";
import type { ConformanceCategory } from "./contracts.js";

export interface ConformanceOutcome {
  id: string;
  category: ConformanceCategory;
  ruleIds: string[];
  passed: boolean;
  actual: unknown;
  expected: unknown;
}

function runFixture({ fixture }: LoadedConformanceFixture): ConformanceOutcome {
  const expected = fixture.expected as {
    ok?: boolean;
    diagnosticCodes?: string[];
    canonicalSource?: string;
    htmlContains?: string[];
    htmlExcludes?: string[];
  };
  const visual = fixture.ruleIds.some((id) => id.startsWith("VIS-"));
  const page = fixture.ruleIds.some((id) => id.startsWith("PAGE-"));
  const intent = fixture.ruleIds.includes("INTENT-RESOLUTION-001");
  if (intent) {
    const result = resolveIntent(fixture.source);
    const actual = {
      outcome: result.kind,
      questionIds:
        result.kind === "clarification"
          ? result.questions.map((question) => question.id)
          : []
    };
    const intentExpected = expected as typeof expected & {
      outcome?: string;
      questionIds?: string[];
    };
    return {
      id: fixture.id,
      category: fixture.category,
      ruleIds: fixture.ruleIds,
      passed:
        actual.outcome === intentExpected.outcome &&
        JSON.stringify(actual.questionIds) ===
          JSON.stringify(intentExpected.questionIds ?? []),
      actual,
      expected
    };
  }
  if (visual) {
    const result = compileVisualSource(fixture.source);
    const actual = {
      ok: result.ok,
      diagnosticCodes: result.ok ? [] : result.diagnostics.map(({ code }) => code)
    };
    return {
      id: fixture.id,
      category: fixture.category,
      ruleIds: fixture.ruleIds,
      passed:
        actual.ok === expected.ok &&
        JSON.stringify(actual.diagnosticCodes) ===
          JSON.stringify(expected.diagnosticCodes ?? []),
      actual,
      expected
    };
  }
  if (page) {
    const result = compilePageSource(fixture.source);
    const actual = {
      ok: result.ok,
      diagnosticCodes: result.ok
        ? []
        : [...new Set(result.diagnostics.map(({ code }) => code))],
      html: result.ok ? result.html : ""
    };
    const passed =
      actual.ok === (expected.ok ?? true) &&
      JSON.stringify(actual.diagnosticCodes) ===
        JSON.stringify(expected.diagnosticCodes ?? []) &&
      (expected.htmlContains ?? []).every((text) => actual.html.includes(text)) &&
      (expected.htmlExcludes ?? []).every((text) => !actual.html.includes(text));
    return {
      id: fixture.id,
      category: fixture.category,
      ruleIds: fixture.ruleIds,
      passed,
      actual: { ok: actual.ok, diagnosticCodes: actual.diagnosticCodes },
      expected
    };
  }
  const result = compileSource(fixture.source);
  if (fixture.category === "runtime" && result.ok) {
    const schema = generateSchema(result.ir).migrationSql;
    const ui = generateUi(result.ir);
    const runtime = generateRuntime(result.ir, buildManifest(result.ir), ui).appMjs;
    const runtimeExpected = expected as typeof expected & {
      schemaContains?: string[];
      runtimeContains?: string[];
      uiContains?: string[];
    };
    const passed =
      (runtimeExpected.schemaContains ?? []).every((text) => schema.includes(text)) &&
      (runtimeExpected.runtimeContains ?? []).every((text) => runtime.includes(text)) &&
      (runtimeExpected.uiContains ?? []).every(
        (text) => ui.appJs.includes(text) || ui.indexHtml.includes(text)
      );
    return {
      id: fixture.id,
      category: fixture.category,
      ruleIds: fixture.ruleIds,
      passed,
      actual: { ok: true },
      expected
    };
  }
  const actual = {
    ok: result.ok,
    diagnosticCodes: result.ok ? [] : result.diagnostics.map(({ code }) => code),
    canonicalSource: result.ok ? formatSource(result.ir) : undefined
  };
  const passed =
    actual.ok === (expected.ok ?? true) &&
    JSON.stringify(actual.diagnosticCodes) ===
      JSON.stringify(expected.diagnosticCodes ?? []) &&
    (expected.canonicalSource === undefined ||
      actual.canonicalSource === expected.canonicalSource);
  return {
    id: fixture.id,
    category: fixture.category,
    ruleIds: fixture.ruleIds,
    passed,
    actual,
    expected
  };
}

export async function runConformance(options: {
  categories?: ConformanceCategory[];
  ruleIds?: string[];
  root?: string;
} = {}) {
  const fixtures = await loadConformanceFixtures(options.root);
  const selected = fixtures.filter(
    ({ fixture }) =>
      (options.categories === undefined ||
        options.categories.includes(fixture.category)) &&
      (options.ruleIds === undefined ||
        fixture.ruleIds.some((id) => options.ruleIds!.includes(id)))
  );
  const outcomes = selected.map(runFixture);
  return {
    passed: outcomes.every((outcome) => outcome.passed),
    total: outcomes.length,
    passedCount: outcomes.filter((outcome) => outcome.passed).length,
    failedCount: outcomes.filter((outcome) => !outcome.passed).length,
    outcomes
  };
}
