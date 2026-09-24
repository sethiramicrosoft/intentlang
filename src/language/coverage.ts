import type { LoadedConformanceFixture } from "./conformance.js";
import type { NormativeRule } from "./contracts.js";
import type { LanguageInventory } from "./inventory.js";

export interface LanguageCoverageReport {
  stableInventoryEntries: number;
  coveredInventoryEntries: number;
  uncoveredInventoryIds: string[];
  stableRules: number;
  rulesWithoutFixtures: string[];
  fixturesWithUnknownRules: Array<{ fixtureId: string; ruleId: string }>;
}

export function buildLanguageCoverageReport(
  inventories: LanguageInventory[],
  rules: NormativeRule[],
  fixtures: LoadedConformanceFixture[]
): LanguageCoverageReport {
  const stableInventoryIds = new Set(
    inventories
      .flatMap((inventory) => inventory.entries)
      .filter((entry) => entry.status === "stable")
      .map((entry) => entry.id)
  );
  const coveredInventoryIds = new Set(
    rules.flatMap((rule) => rule.inventoryIds ?? [])
  );
  const knownRuleIds = new Set(rules.map((rule) => rule.id));
  const fixtureRuleIds = new Set(
    fixtures.flatMap(({ fixture }) => fixture.ruleIds)
  );

  return {
    stableInventoryEntries: stableInventoryIds.size,
    coveredInventoryEntries: [...stableInventoryIds].filter((id) =>
      coveredInventoryIds.has(id)
    ).length,
    uncoveredInventoryIds: [...stableInventoryIds]
      .filter((id) => !coveredInventoryIds.has(id))
      .sort(),
    stableRules: rules.filter((rule) => rule.status === "stable").length,
    rulesWithoutFixtures: rules
      .filter(
        (rule) =>
          rule.status === "stable" && !fixtureRuleIds.has(rule.id)
      )
      .map((rule) => rule.id)
      .sort(),
    fixturesWithUnknownRules: fixtures
      .flatMap(({ fixture }) =>
        fixture.ruleIds.map((ruleId) => ({ fixtureId: fixture.id, ruleId }))
      )
      .filter(({ ruleId }) => !knownRuleIds.has(ruleId))
  };
}
