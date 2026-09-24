import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  loadJsonFile,
  parseRuleRegistry,
  type NormativeRule,
  type RuleRegistry
} from "./contracts.js";

export interface LoadedRuleRegistry {
  languageVersion: string;
  files: string[];
  rules: NormativeRule[];
}

export async function loadRuleRegistries(
  root = process.cwd()
): Promise<LoadedRuleRegistry> {
  const directory = resolve(root, "language", "rules");
  const names = (await readdir(directory))
    .filter((name) => name.endsWith(".json"))
    .sort();
  const registries: Array<{ file: string; registry: RuleRegistry }> =
    await Promise.all(
      names.map(async (name) => ({
        file: resolve(directory, name),
        registry: parseRuleRegistry(
          await loadJsonFile(resolve(directory, name))
        )
      }))
    );

  const versions = new Set(
    registries.map(({ registry }) => registry.languageVersion)
  );
  if (versions.size > 1) {
    throw new Error(
      `Rule registry files disagree on language version: ${[...versions].join(", ")}`
    );
  }

  const rules = registries.flatMap(({ registry }) => registry.rules);
  const seenIds = new Set<string>();
  for (const rule of rules) {
    if (seenIds.has(rule.id)) {
      throw new Error(`Duplicate normative rule ID ${rule.id} across files`);
    }
    seenIds.add(rule.id);
  }

  return {
    languageVersion: versions.values().next().value ?? "",
    files: registries.map(({ file }) => file),
    rules
  };
}
