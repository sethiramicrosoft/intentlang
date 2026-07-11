import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const credentialLiteral =
  /(?:password|passwd|secret|credential)\s*[:=]\s*["'][^"']+["']/gi;

test("tests contain no saved credential literals", async () => {
  const files = await collectTypeScriptFiles(join(process.cwd(), "test"));
  const violations: string[] = [];

  for (const file of files) {
    const content = await readFile(file, "utf8");
    if (credentialLiteral.test(content)) {
      violations.push(file);
    }
    credentialLiteral.lastIndex = 0;
  }

  assert.deepEqual(
    violations,
    [],
    "Generate authentication inputs at runtime; never save credential literals."
  );
});

async function collectTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(path);
    }
  }

  return files;
}
