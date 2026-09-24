import { readFile } from "node:fs/promises";

export const ruleStatuses = [
  "experimental",
  "stable",
  "deprecated",
  "removed"
] as const;

export type RuleStatus = (typeof ruleStatuses)[number];

export const compatibilityClasses = [
  "patch-stable",
  "minor-additive",
  "major-breaking"
] as const;

export type CompatibilityClass = (typeof compatibilityClasses)[number];

export interface RuleEvidence {
  positive: string[];
  negative: string[];
  canonical?: string[];
  runtime?: string[];
}

export interface NormativeRule {
  id: string;
  status: RuleStatus;
  title: string;
  canonicalForm: string;
  compatibilityClass: CompatibilityClass;
  evidence: RuleEvidence;
  specification?: string;
}

export interface RuleRegistry {
  languageVersion: string;
  rules: NormativeRule[];
}

export const conformanceCategories = [
  "valid",
  "invalid",
  "ambiguous",
  "canonical",
  "runtime",
  "compatibility"
] as const;

export type ConformanceCategory = (typeof conformanceCategories)[number];

export interface ConformanceFixture {
  id: string;
  category: ConformanceCategory;
  ruleIds: string[];
  source: string;
  expected: unknown;
}

export interface SemanticManifest {
  languageVersion: string;
  irVersion: string;
  compilerVersion: string;
  sourceFingerprint: string;
  semanticFingerprint: string;
  dependencyFingerprint?: string;
  generatorVersions: Record<string, string>;
}

export interface TraceLink {
  sourceId: string;
  sourceSpan: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  ruleIds: string[];
  irNodeIds: string[];
  artifacts: Array<{
    kind: string;
    path: string;
    symbol?: string;
  }>;
}

const ruleIdPattern = /^[A-Z]+(?:-[A-Z]+)*-[0-9]{3}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(
  value: Record<string, unknown>,
  key: string,
  context: string
): string {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate.length === 0) {
    throw new Error(`${context}.${key} must be a non-empty string`);
  }
  return candidate;
}

function requireStringArray(
  value: Record<string, unknown>,
  key: string,
  context: string
): string[] {
  const candidate = value[key];
  if (
    !Array.isArray(candidate) ||
    candidate.some((item) => typeof item !== "string")
  ) {
    throw new Error(`${context}.${key} must be an array of strings`);
  }
  return candidate;
}

export function parseRuleRegistry(value: unknown): RuleRegistry {
  if (!isRecord(value)) {
    throw new Error("Rule registry must be an object");
  }

  const languageVersion = requireString(value, "languageVersion", "registry");
  if (!Array.isArray(value.rules)) {
    throw new Error("registry.rules must be an array");
  }

  const seenIds = new Set<string>();
  const rules = value.rules.map((candidate, index): NormativeRule => {
    const context = `registry.rules[${index}]`;
    if (!isRecord(candidate)) {
      throw new Error(`${context} must be an object`);
    }

    const id = requireString(candidate, "id", context);
    if (!ruleIdPattern.test(id)) {
      throw new Error(`${context}.id is not a valid normative rule ID`);
    }
    if (seenIds.has(id)) {
      throw new Error(`Duplicate normative rule ID ${id}`);
    }
    seenIds.add(id);

    const status = requireString(candidate, "status", context);
    if (!ruleStatuses.includes(status as RuleStatus)) {
      throw new Error(`${context}.status is not recognized`);
    }

    const compatibilityClass = requireString(
      candidate,
      "compatibilityClass",
      context
    );
    if (
      !compatibilityClasses.includes(
        compatibilityClass as CompatibilityClass
      )
    ) {
      throw new Error(`${context}.compatibilityClass is not recognized`);
    }

    if (!isRecord(candidate.evidence)) {
      throw new Error(`${context}.evidence must be an object`);
    }

    const evidence: RuleEvidence = {
      positive: requireStringArray(
        candidate.evidence,
        "positive",
        `${context}.evidence`
      ),
      negative: requireStringArray(
        candidate.evidence,
        "negative",
        `${context}.evidence`
      )
    };
    if (candidate.evidence.canonical !== undefined) {
      evidence.canonical = requireStringArray(
        candidate.evidence,
        "canonical",
        `${context}.evidence`
      );
    }
    if (candidate.evidence.runtime !== undefined) {
      evidence.runtime = requireStringArray(
        candidate.evidence,
        "runtime",
        `${context}.evidence`
      );
    }

    const rule: NormativeRule = {
      id,
      status: status as RuleStatus,
      title: requireString(candidate, "title", context),
      canonicalForm: requireString(candidate, "canonicalForm", context),
      compatibilityClass: compatibilityClass as CompatibilityClass,
      evidence
    };
    if (candidate.specification !== undefined) {
      rule.specification = requireString(candidate, "specification", context);
    }
    return rule;
  });

  return { languageVersion, rules };
}

export function parseConformanceFixture(value: unknown): ConformanceFixture {
  if (!isRecord(value)) {
    throw new Error("Conformance fixture must be an object");
  }

  const category = requireString(value, "category", "fixture");
  if (!conformanceCategories.includes(category as ConformanceCategory)) {
    throw new Error("fixture.category is not recognized");
  }

  const ruleIds = requireStringArray(value, "ruleIds", "fixture");
  if (ruleIds.length === 0) {
    throw new Error("fixture.ruleIds must contain at least one rule ID");
  }
  for (const ruleId of ruleIds) {
    if (!ruleIdPattern.test(ruleId)) {
      throw new Error(`fixture.ruleIds contains invalid rule ID ${ruleId}`);
    }
  }

  if (!Object.hasOwn(value, "expected")) {
    throw new Error("fixture.expected is required");
  }

  return {
    id: requireString(value, "id", "fixture"),
    category: category as ConformanceCategory,
    ruleIds,
    source: requireString(value, "source", "fixture"),
    expected: value.expected
  };
}

export async function loadJsonFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}
