import assert from "node:assert/strict";
import test from "node:test";
import { loadConformanceFixtures } from "../src/language/conformance.js";
import { buildLanguageCoverageReport } from "../src/language/coverage.js";
import { loadLanguageInventories } from "../src/language/inventory.js";
import { loadRuleRegistries } from "../src/language/rule-registry.js";

test("coverage report is honest about initial rule coverage", async () => {
  const [inventories, registry, fixtures] = await Promise.all([
    loadLanguageInventories(),
    loadRuleRegistries(),
    loadConformanceFixtures()
  ]);
  const report = buildLanguageCoverageReport(
    inventories,
    registry.rules,
    fixtures
  );

  assert.equal(report.stableRules, 5);
  assert.equal(report.rulesWithoutFixtures.length, 0);
  assert.deepEqual(report.fixturesWithUnknownRules, []);
  assert.ok(report.coveredInventoryEntries > 0);
  assert.ok(
    report.uncoveredInventoryIds.length > 0,
    "Initial registry must not falsely claim complete coverage"
  );
});
