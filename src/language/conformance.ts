import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  loadJsonFile,
  parseConformanceFixture,
  type ConformanceFixture
} from "./contracts.js";

async function jsonFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry): Promise<string[]> => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        return jsonFiles(path);
      }
      return entry.isFile() && entry.name.endsWith(".json") ? [path] : [];
    })
  );
  return paths.flat().sort();
}

export interface LoadedConformanceFixture {
  path: string;
  fixture: ConformanceFixture;
}

export async function loadConformanceFixtures(
  root = process.cwd()
): Promise<LoadedConformanceFixture[]> {
  const files = await jsonFiles(resolve(root, "conformance"));
  const fixtures = await Promise.all(
    files.map(async (path) => ({
      path,
      fixture: parseConformanceFixture(await loadJsonFile(path))
    }))
  );

  const ids = new Set<string>();
  for (const { fixture } of fixtures) {
    if (ids.has(fixture.id)) {
      throw new Error(`Duplicate conformance fixture ID ${fixture.id}`);
    }
    ids.add(fixture.id);
  }
  return fixtures;
}
