import assert from "node:assert/strict";
import test from "node:test";
import { loadConformanceFixtures } from "../src/language/conformance.js";
import { buildLanguageCoverageReport } from "../src/language/coverage.js";
import { loadLanguageInventories } from "../src/language/inventory.js";
import { loadRuleRegistries } from "../src/language/rule-registry.js";

test("coverage report maps every stable inventory entry to rules and fixtures", async () => {
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

  assert.equal(report.stableRules, 17);
  assert.equal(report.rulesWithoutFixtures.length, 0);
  assert.deepEqual(report.fixturesWithUnknownRules, []);
  assert.equal(report.coveredInventoryEntries, report.stableInventoryEntries);
  assert.deepEqual(report.uncoveredInventoryIds, []);
});
