import { resolve } from "node:path";
import { loadJsonFile, ruleStatuses, type RuleStatus } from "./contracts.js";

export const inventoryCategories = [
  "syntax",
  "diagnostic",
  "ir",
  "obligation"
] as const;

export type InventoryCategory = (typeof inventoryCategories)[number];

export interface InventoryEntry {
  id: string;
  category: InventoryCategory;
  status: RuleStatus;
  title: string;
  implementation: string[];
}

export interface LanguageInventory {
  languageVersion: string;
  surface: string;
  entries: InventoryEntry[];
}

export interface InventoryReport {
  files: number;
  entries: number;
  stable: number;
  experimental: number;
  byCategory: Record<InventoryCategory, number>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

export function parseLanguageInventory(value: unknown): LanguageInventory {
  if (!isRecord(value)) {
    throw new Error("Language inventory must be an object");
  }
  const languageVersion = nonEmptyString(
    value.languageVersion,
    "inventory.languageVersion"
  );
  const surface = nonEmptyString(value.surface, "inventory.surface");
  if (!Array.isArray(value.entries)) {
    throw new Error("inventory.entries must be an array");
  }

  const ids = new Set<string>();
  const entries = value.entries.map((candidate, index): InventoryEntry => {
    const path = `inventory.entries[${index}]`;
    if (!isRecord(candidate)) {
      throw new Error(`${path} must be an object`);
    }
    const id = nonEmptyString(candidate.id, `${path}.id`);
    if (ids.has(id)) {
      throw new Error(`Duplicate inventory entry ${id}`);
    }
    ids.add(id);
    const category = nonEmptyString(candidate.category, `${path}.category`);
    if (!inventoryCategories.includes(category as InventoryCategory)) {
      throw new Error(`${path}.category is not recognized`);
    }
    const status = nonEmptyString(candidate.status, `${path}.status`);
    if (!ruleStatuses.includes(status as RuleStatus)) {
      throw new Error(`${path}.status is not recognized`);
    }
    if (
      !Array.isArray(candidate.implementation) ||
      candidate.implementation.length === 0 ||
      candidate.implementation.some(
        (reference) => typeof reference !== "string" || reference.length === 0
      )
    ) {
      throw new Error(
        `${path}.implementation must contain at least one source reference`
      );
    }
    return {
      id,
      category: category as InventoryCategory,
      status: status as RuleStatus,
      title: nonEmptyString(candidate.title, `${path}.title`),
      implementation: candidate.implementation as string[]
    };
  });

  return { languageVersion, surface, entries };
}

export async function loadLanguageInventories(
  root = process.cwd()
): Promise<LanguageInventory[]> {
  const names = [
    "0.8-business-inventory.json",
    "0.8-visual-inventory.json",
    "0.8-diagnostics-inventory.json",
    "0.8-ir-inventory.json"
  ];
  return Promise.all(
    names.map(async (name) =>
      parseLanguageInventory(
        await loadJsonFile(resolve(root, "language", "versions", name))
      )
    )
  );
}

export function summarizeInventories(
  inventories: LanguageInventory[]
): InventoryReport {
  const entries = inventories.flatMap((inventory) => inventory.entries);
  const byCategory: Record<InventoryCategory, number> = {
    syntax: 0,
    diagnostic: 0,
    ir: 0,
    obligation: 0
  };
  for (const entry of entries) {
    byCategory[entry.category] += 1;
  }
  return {
    files: inventories.length,
    entries: entries.length,
    stable: entries.filter((entry) => entry.status === "stable").length,
    experimental: entries.filter(
      (entry) => entry.status === "experimental"
    ).length,
    byCategory
  };
}
