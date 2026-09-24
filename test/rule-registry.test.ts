import assert from "node:assert/strict";
import test from "node:test";
import { loadRuleRegistries } from "../src/language/rule-registry.js";

test("rule registry loads all files with globally unique IDs", async () => {
  const registry = await loadRuleRegistries();

  assert.equal(registry.languageVersion, "0.8.0-alpha.0");
  assert.equal(registry.files.length, 2);
  assert.equal(registry.rules.length, 25);
  assert.equal(
    new Set(registry.rules.map((rule) => rule.id)).size,
    registry.rules.length
  );
});

test("every initial rule links implementation inventory and evidence", async () => {
  const registry = await loadRuleRegistries();
  for (const rule of registry.rules) {
    assert.ok(rule.inventoryIds?.length, `${rule.id} has no inventory links`);
    assert.ok(rule.evidence.positive.length, `${rule.id} has no positive evidence`);
    assert.ok(rule.evidence.negative.length, `${rule.id} has no negative evidence`);
  }
});
