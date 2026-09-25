import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadLanguageInventories } from "./inventory.js";
import { loadRuleRegistries } from "./rule-registry.js";

export interface GovernanceIssue {
  code: string;
  message: string;
  path?: string;
}

export interface GovernanceReport {
  valid: boolean;
  issues: GovernanceIssue[];
  changedLanguageFiles: string[];
}

const proposalSections = [
  "Problem and user scenario",
  "Normative rule identifiers",
  "Grammar and canonical form",
  "Typed semantics and IR",
  "Ambiguity and context closure",
  "Security and privacy effects",
  "Compatibility and migration",
  "Diagnostics and recovery",
  "Generator and runtime obligations",
  "Evidence plan",
  "Documentation and examples",
  "Traceability",
  "Measurable outcome",
  "Graduation criteria"
];

const requiredGovernanceFiles = [
  "docs/research/comprehension-study-protocol.md",
  "studies/comprehension/tasks.json",
  "studies/comprehension/result.schema.json",
  "studies/comprehension/STATUS.md",
  "docs/governance/language-proposal-template.md",
  "docs/governance/language-change-checklist.md",
  "docs/governance/release-checklist.md",
  "docs/governance/independent-review-brief.md",
  "docs/governance/independent-review-report-template.md",
  ".github/PULL_REQUEST_TEMPLATE.md"
];

function normalize(path: string): string {
  return path.replaceAll("\\", "/");
}

function languageAffecting(path: string): boolean {
  return /^(src\/(?:parser|model|compiler|formatter|generator|runtime-codegen|ui-codegen)\.ts|src\/language\/|language\/(?:rules|versions)\/|conformance\/)/.test(
    normalize(path)
  );
}

export async function validateGovernance(
  root = process.cwd(),
  changedFiles: string[] = []
): Promise<GovernanceReport> {
  const issues: GovernanceIssue[] = [];
  for (const path of requiredGovernanceFiles) {
    if (!existsSync(resolve(root, path))) {
      issues.push({ code: "G001", path, message: "Required governance artifact is missing." });
    }
  }

  const templatePath = resolve(
    root,
    "docs/governance/language-proposal-template.md"
  );
  if (existsSync(templatePath)) {
    const template = readFileSync(templatePath, "utf8");
    for (const section of proposalSections) {
      if (!template.includes(`## ${section}`)) {
        issues.push({
          code: "G002",
          path: "docs/governance/language-proposal-template.md",
          message: `Proposal template is missing "${section}".`
        });
      }
    }
  }

  const tasksPath = resolve(root, "studies/comprehension/tasks.json");
  if (existsSync(tasksPath)) {
    try {
      const corpus = JSON.parse(readFileSync(tasksPath, "utf8")) as {
        assignmentGroups?: Record<string, unknown[]>;
        tasks?: Array<Record<string, unknown>>;
      };
      if (!corpus.tasks || corpus.tasks.length < 3) {
        issues.push({ code: "G003", path: "studies/comprehension/tasks.json", message: "Study corpus requires at least three tasks." });
      }
      for (const task of corpus.tasks ?? []) {
        for (const key of ["id", "semanticGoal", "prompt", "rubric", "intentlang", "typescript"]) {
          if (!Object.hasOwn(task, key)) {
            issues.push({ code: "G003", path: "studies/comprehension/tasks.json", message: `Study task is missing ${key}.` });
          }
        }
      }
      if (Object.keys(corpus.assignmentGroups ?? {}).length < 2) {
        issues.push({ code: "G003", path: "studies/comprehension/tasks.json", message: "Study corpus requires counterbalanced assignment groups." });
      }
    } catch (error) {
      issues.push({ code: "G003", path: "studies/comprehension/tasks.json", message: error instanceof Error ? error.message : "Invalid study corpus." });
    }
  }

  const [registry, inventories] = await Promise.all([
    loadRuleRegistries(root),
    loadLanguageInventories(root)
  ]);
  const inventoryIds = new Set(
    inventories.flatMap((inventory) =>
      inventory.entries.map((entry) => entry.id)
    )
  );
  for (const rule of registry.rules) {
    for (const id of rule.inventoryIds ?? []) {
      if (!inventoryIds.has(id)) {
        issues.push({ code: "G004", message: `${rule.id} references unknown inventory entry ${id}.` });
      }
    }
    if (!rule.specification || !existsSync(resolve(root, rule.specification.split("#")[0]!))) {
      issues.push({ code: "G005", path: rule.specification, message: `${rule.id} has no resolvable normative specification.` });
    }
    for (const evidence of [
      ...rule.evidence.positive,
      ...rule.evidence.negative,
      ...(rule.evidence.canonical ?? []),
      ...(rule.evidence.runtime ?? [])
    ]) {
      if (!existsSync(resolve(root, evidence))) {
        issues.push({ code: "G006", path: evidence, message: `${rule.id} references missing evidence.` });
      }
    }
  }

  const proposalsDirectory = resolve(root, "docs/spec/proposals");
  if (existsSync(proposalsDirectory)) {
    const names = readdirSync(proposalsDirectory)
      .filter((name) => /^\d{4}-.*\.md$/.test(name))
      .sort();
    names.forEach((name, index) => {
      const expected = String(index + 1).padStart(4, "0");
      if (!name.startsWith(expected)) {
        issues.push({ code: "G007", path: `docs/spec/proposals/${name}`, message: `Proposal sequence expected ${expected}.` });
      }
    });
  }

  const changedLanguageFiles = changedFiles.filter(languageAffecting);
  if (changedLanguageFiles.length > 0) {
    const changed = changedFiles.map(normalize);
    const requirements: Array<[string, RegExp]> = [
      ["proposal", /^docs\/spec\/proposals\/\d{4}-.*\.md$/],
      ["normative specification", /^docs\/spec\/(?!proposals\/).*\.md$/],
      ["rule or inventory", /^language\/(?:rules|versions)\/.*\.json$/],
      ["test or conformance evidence", /^(?:test\/.*\.test\.ts|conformance\/.*\.json)$/],
      ["compatibility evidence", /^(?:test\/(?:compatibility|semantic-fingerprint|canonical-properties)\.test\.ts|docs\/spec\/proposals\/.*\.md)$/],
      ["traceability evidence", /^(?:test\/.*trace.*\.test\.ts|src\/language\/trace\.ts|docs\/spec\/proposals\/.*\.md)$/],
      ["documentation or example", /^(?:README\.md|docs\/.*\.md|examples\/)/]
    ];
    for (const [label, pattern] of requirements) {
      if (!changed.some((path) => pattern.test(path))) {
        issues.push({ code: "G008", message: `Language-affecting changes require changed ${label}.` });
      }
    }
  }

  return { valid: issues.length === 0, issues, changedLanguageFiles };
}
