import assert from "node:assert/strict";
import test from "node:test";
import { validateGovernance } from "../src/language/governance.js";

test("repository governance artifacts and links are complete", async () => {
  const report = await validateGovernance();
  assert.equal(report.valid, true, JSON.stringify(report.issues, null, 2));
});

test("language changes require proposal, specification, evidence, compatibility, traceability, and docs", async () => {
  const incomplete = await validateGovernance(process.cwd(), [
    "src/language/new-feature.ts"
  ]);
  assert.equal(incomplete.valid, false);
  assert.ok(incomplete.issues.some((issue) => issue.code === "G008"));

  const complete = await validateGovernance(process.cwd(), [
    "src/language/new-feature.ts",
    "docs/spec/proposals/0006-independent-tooling.md",
    "docs/spec/independent-tooling.md",
    "language/rules/0.8-business.json",
    "test/independent-tooling.test.ts",
    "README.md"
  ]);
  assert.equal(complete.valid, true, JSON.stringify(complete.issues, null, 2));
});

test("the human-evidence governance change satisfies its own evidence contract", async () => {
  const report = await validateGovernance(process.cwd(), [
    "src/language/governance.ts",
    "src/language/study-analysis.ts",
    "docs/spec/proposals/0007-human-evidence-governance.md",
    "docs/spec/language-governance.md",
    "language/rules/0.8-business.json",
    "language/versions/0.8-ir-inventory.json",
    "test/governance.test.ts",
    "test/study-analysis.test.ts",
    "README.md"
  ]);
  assert.equal(report.valid, true, JSON.stringify(report.issues, null, 2));
});
