import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import test from "node:test";
import {
  loadLanguageInventories,
  parseLanguageInventory,
  summarizeInventories
} from "../src/language/inventory.js";

test("all current language inventories load with unique entries", async () => {
  const inventories = await loadLanguageInventories();
  const report = summarizeInventories(inventories);

  assert.equal(report.files, 4);
  assert.ok(report.entries >= 100, `Expected at least 100 entries, got ${report.entries}`);
  assert.ok(report.byCategory.syntax >= 40);
  assert.ok(report.byCategory.diagnostic >= 40);
  assert.ok(report.byCategory.ir >= 8);
  assert.ok(report.byCategory.obligation >= 9);

  const allIds = inventories.flatMap((inventory) =>
    inventory.entries.map((entry) => entry.id)
  );
  assert.equal(new Set(allIds).size, allIds.length);
});

test("every literal compiler diagnostic code is inventoried", async () => {
  const inventories = await loadLanguageInventories();
  const declared = new Set(
    inventories
      .flatMap((inventory) => inventory.entries)
      .filter((entry) => entry.category === "diagnostic")
      .map((entry) => entry.id)
  );
  const files = [
    "src/parser.ts",
    "src/visual.ts"
  ];
  const used = new Set<string>();
  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/"(E\d{3}|V\d{3})"/g)) {
      used.add(match[1]!);
    }
  }

  assert.deepEqual(
    [...used].filter((code) => !declared.has(code)),
    [],
    "Implementation uses diagnostic codes absent from the inventory"
  );
  assert.ok(declared.has("W001"));
  assert.ok(declared.has("W002"));
});

test("every inventory implementation reference resolves", async () => {
  const inventories = await loadLanguageInventories();
  for (const entry of inventories.flatMap((inventory) => inventory.entries)) {
    for (const reference of entry.implementation) {
      const separator = reference.indexOf(":");
      const file = separator === -1 ? reference : reference.slice(0, separator);
      const symbol = separator === -1 ? undefined : reference.slice(separator + 1);
      await access(file);
      if (symbol) {
        const source = await readFile(file, "utf8");
        assert.ok(
          source.includes(symbol),
          `${entry.id} references missing symbol ${symbol} in ${file}`
        );
      }
    }
  }
});

test("inventory validation rejects duplicate IDs and missing evidence", () => {
  const entry = {
    id: "BUS-SYNTAX-001",
    category: "syntax",
    status: "stable",
    title: "Application declaration",
    implementation: ["src/parser.ts:applicationPattern"]
  };
  assert.throws(
    () =>
      parseLanguageInventory({
        languageVersion: "0.8",
        surface: "business",
        entries: [entry, entry]
      }),
    /Duplicate inventory entry/
  );
  assert.throws(
    () =>
      parseLanguageInventory({
        languageVersion: "0.8",
        surface: "business",
        entries: [{ ...entry, implementation: [] }]
      }),
    /at least one source reference/
  );
});
