import assert from "node:assert/strict";
import test from "node:test";
import {
  parseConformanceFixture,
  parseRuleRegistry
} from "../src/language/contracts.js";

const validRule = {
  id: "APP-DECL-001",
  status: "stable",
  title: "Application declaration",
  canonicalForm: "application <Name> with id <id>",
  compatibilityClass: "patch-stable",
  evidence: {
    positive: ["conformance/valid/application-declaration.json"],
    negative: ["conformance/invalid/application-declaration.json"]
  }
};

test("rule registry accepts a well-formed registry", () => {
  const registry = parseRuleRegistry({
    languageVersion: "0.8",
    rules: [validRule]
  });

  assert.equal(registry.rules[0]?.id, "APP-DECL-001");
});

test("rule registry rejects duplicate rule IDs", () => {
  assert.throws(
    () =>
      parseRuleRegistry({
        languageVersion: "0.8",
        rules: [validRule, validRule]
      }),
    /Duplicate normative rule ID APP-DECL-001/
  );
});

test("rule registry rejects invalid statuses and rule IDs", () => {
  assert.throws(
    () =>
      parseRuleRegistry({
        languageVersion: "0.8",
        rules: [{ ...validRule, id: "not-valid" }]
      }),
    /not a valid normative rule ID/
  );
  assert.throws(
    () =>
      parseRuleRegistry({
        languageVersion: "0.8",
        rules: [{ ...validRule, status: "draft" }]
      }),
    /status is not recognized/
  );
});

test("conformance fixture requires categorized rule-linked evidence", () => {
  const fixture = parseConformanceFixture({
    id: "application-declaration-valid",
    category: "valid",
    ruleIds: ["APP-DECL-001"],
    source: "application Todo with id todo",
    expected: { ok: true }
  });

  assert.equal(fixture.category, "valid");
  assert.deepEqual(fixture.ruleIds, ["APP-DECL-001"]);
});

test("conformance fixture rejects missing or invalid rule links", () => {
  assert.throws(
    () =>
      parseConformanceFixture({
        id: "unlinked",
        category: "valid",
        ruleIds: [],
        source: "application Todo",
        expected: { ok: true }
      }),
    /at least one rule ID/
  );
  assert.throws(
    () =>
      parseConformanceFixture({
        id: "bad-category",
        category: "maybe",
        ruleIds: ["APP-DECL-001"],
        source: "application Todo",
        expected: { ok: true }
      }),
    /category is not recognized/
  );
});
