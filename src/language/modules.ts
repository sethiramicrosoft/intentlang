import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { canonicalJson, compileSource } from "../compiler.js";
import type { CompileResult, Diagnostic } from "../model.js";
import { sha256 } from "./semantic-fingerprint.js";

export interface ModuleDependency {
  name: string;
  alias: string;
  path: string;
  integrity: string;
}

export interface ProjectSourceLine {
  file: string;
  line: number;
}

export type ProjectCompileResult =
  | {
      ok: true;
      ir: Extract<CompileResult, { ok: true }>["ir"];
      output: string;
      source: string;
      sourceMap: ProjectSourceLine[];
      dependencies: Record<string, string>;
      modules: ModuleDependency[];
      lock: string;
    }
  | {
      ok: false;
      diagnostics: Diagnostic[];
    };

interface ImportDeclaration {
  path: string;
  alias: string;
  line: number;
}

interface ParsedModule {
  name?: string;
  exported: boolean;
  imports: ImportDeclaration[];
  body: Array<{ text: string; line: number }>;
}

function diagnostic(
  code: string,
  message: string,
  line: number,
  source: string,
  hint: string
): Diagnostic {
  return {
    code,
    message,
    line,
    column: Math.max(1, source.search(/\S/) + 1),
    length: Math.max(1, source.trim().length),
    hint
  };
}

function parseModuleSource(source: string): ParsedModule | Diagnostic {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const imports: ImportDeclaration[] = [];
  const body: Array<{ text: string; line: number }> = [];
  const aliases = new Set<string>();
  let name: string | undefined;
  let exported = false;

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]!;
    const trimmed = raw.trim();
    const moduleMatch =
      /^module ([A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*)*)$/.exec(trimmed);
    if (moduleMatch) {
      if (name) {
        return diagnostic("E064", "A file may declare only one module.", index + 1, raw, "Remove the duplicate module declaration.");
      }
      name = moduleMatch[1]!;
      continue;
    }
    const importMatch =
      /^import "([^"]+)" as ([A-Z][A-Za-z0-9]*)$/.exec(trimmed);
    if (importMatch) {
      if (aliases.has(importMatch[2]!)) {
        return diagnostic("E067", `Import alias "${importMatch[2]}" is already used.`, index + 1, raw, "Use a unique alias in this file.");
      }
      aliases.add(importMatch[2]!);
      imports.push({
        path: importMatch[1]!,
        alias: importMatch[2]!,
        line: index + 1
      });
      continue;
    }
    if (trimmed === "export all") {
      exported = true;
      continue;
    }
    const versionMatch = /^requires IntentLang ([0-9]+\.[0-9]+)$/.exec(trimmed);
    if (versionMatch) {
      if (versionMatch[1] !== "0.8") {
        return diagnostic(
          "E072",
          `This project requires IntentLang ${versionMatch[1]}, but the compiler provides 0.8.`,
          index + 1,
          raw,
          "Use a compatible compiler or update the reviewed version requirement."
        );
      }
      continue;
    }
    body.push({ text: raw, line: index + 1 });
  }
  return { name, exported, imports, body };
}

export async function compileProject(
  entryPath: string,
  options: { verifyLock?: boolean; entrySource?: string } = {}
): Promise<ProjectCompileResult> {
  const rootPath = resolve(entryPath);
  const projectRoot = dirname(rootPath);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const modulePaths = new Map<string, string>();
  const flattened: string[] = [];
  const sourceMap: ProjectSourceLine[] = [];
  const dependencies: Record<string, string> = {};
  const modules: ModuleDependency[] = [];
  const diagnostics: Diagnostic[] = [];

  const visit = async (
    filePath: string,
    expectedAlias?: string,
    importLine = 1
  ): Promise<void> => {
    const absolutePath = resolve(filePath);
    const projectRelative = relative(projectRoot, absolutePath);
    if (
      isAbsolute(projectRelative) ||
      projectRelative === ".." ||
      projectRelative.startsWith(`..\\`)
    ) {
      diagnostics.push(
        diagnostic("E068", `Import "${filePath}" escapes the project root.`, importLine, filePath, "Import only files inside the entry file's directory.")
      );
      return;
    }
    if (visiting.has(absolutePath)) {
      diagnostics.push(
        diagnostic("E066", `Module import cycle reaches "${projectRelative}".`, importLine, filePath, "Remove one import so the module graph is acyclic.")
      );
      return;
    }
    if (visited.has(absolutePath)) return;

    let source: string;
    try {
      source =
        absolutePath === rootPath && options.entrySource !== undefined
          ? options.entrySource
          : await readFile(absolutePath, "utf8");
    } catch {
      diagnostics.push(
        diagnostic("E065", `Imported file "${projectRelative}" could not be read.`, importLine, filePath, "Check the relative import path.")
      );
      return;
    }
    const parsed = parseModuleSource(source);
    if ("code" in parsed) {
      diagnostics.push({ ...parsed, file: absolutePath });
      return;
    }
    const isRoot = absolutePath === rootPath;
    if (!isRoot && !parsed.name) {
      diagnostics.push(
        diagnostic("E064", `Imported file "${projectRelative}" has no module declaration.`, 1, source.split(/\r?\n/)[0] ?? "", "Add a qualified module declaration.")
      );
      return;
    }
    if (!isRoot && !parsed.exported) {
      diagnostics.push(
        diagnostic("E069", `Module "${parsed.name}" does not export its declarations.`, 1, source.split(/\r?\n/)[0] ?? "", 'Add "export all".')
      );
      return;
    }
    if (parsed.name) {
      const previous = modulePaths.get(parsed.name);
      if (previous && previous !== absolutePath) {
        diagnostics.push(
          diagnostic("E070", `Module name "${parsed.name}" is declared by multiple files.`, 1, source.split(/\r?\n/)[0] ?? "", "Use a globally unique qualified module name.")
        );
        return;
      }
      modulePaths.set(parsed.name, absolutePath);
    }

    visiting.add(absolutePath);
    for (const imported of parsed.imports) {
      await visit(
        resolve(dirname(absolutePath), imported.path),
        imported.alias,
        imported.line
      );
    }
    visiting.delete(absolutePath);
    visited.add(absolutePath);

    if (!isRoot && parsed.name) {
      const normalized = source.replaceAll("\r\n", "\n");
      const integrity = sha256(normalized);
      dependencies[parsed.name] = integrity;
      modules.push({
        name: parsed.name,
        alias: expectedAlias ?? parsed.name.split(".").at(-1)!,
        path: projectRelative,
        integrity
      });
    }
    for (const line of parsed.body) {
      flattened.push(line.text);
      sourceMap.push({ file: absolutePath, line: line.line });
    }
  };

  await visit(rootPath);
  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const source = flattened.join("\n");
  const result = compileSource(source);
  if (!result.ok) {
    return {
      ok: false,
      diagnostics: result.diagnostics.map((item) => {
        const mapped = sourceMap[item.line - 1];
        return mapped
          ? { ...item, file: mapped.file, line: mapped.line }
          : item;
      })
    };
  }
  const lock = `${canonicalJson({
    languageVersion: "0.8.0-alpha.0",
    entry: relative(projectRoot, rootPath),
    dependencies
  })}\n`;
  const lockPath = rootPath.replace(/\.intent$/i, ".lock.json");
  if (options.verifyLock !== false && existsSync(lockPath)) {
    try {
      const expected = JSON.parse(await readFile(lockPath, "utf8")) as {
        dependencies?: Record<string, string>;
      };
      if (
        canonicalJson(expected.dependencies ?? {}) !==
        canonicalJson(dependencies)
      ) {
        return {
          ok: false,
          diagnostics: [
            diagnostic(
              "E071",
              `Dependency integrity does not match "${lockPath}".`,
              1,
              rootPath,
              "Review dependency changes and regenerate the lock with --write-lock."
            )
          ]
        };
      }
    } catch {
      return {
        ok: false,
        diagnostics: [
          diagnostic(
            "E071",
            `Dependency lock "${lockPath}" is invalid.`,
            1,
            rootPath,
            "Replace it with a valid generated lock file."
          )
        ]
      };
    }
  }
  return {
    ...result,
    source,
    sourceMap,
    dependencies,
    modules,
    lock
  };
}
