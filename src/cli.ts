#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalJson, compileSource, formatSource } from "./compiler.js";
import { generateSchema } from "./generator.js";
import { buildManifest } from "./manifest.js";
import type { BuildManifest } from "./model.js";
import { planMigration } from "./planner.js";
import { generateRuntime } from "./runtime-codegen.js";
import { generateUi } from "./ui-codegen.js";
import { effectiveAiConfig } from "./ai-provider.js";
import type { AiProviderKind } from "./ai-provider.js";
import { compileEnglishSource } from "./english.js";
import { loadConformanceFixtures } from "./language/conformance.js";
import { buildLanguageCoverageReport } from "./language/coverage.js";
import { loadLanguageInventories } from "./language/inventory.js";
import { loadRuleRegistries } from "./language/rule-registry.js";
import { buildTraceMap } from "./language/trace.js";
import { remapTraceMapSources } from "./language/trace.js";
import { compileProject } from "./language/modules.js";
import { runConformance } from "./language/conformance-runner.js";
import { validateSemanticManifest } from "./language/manifest-validator.js";
import {
  evaluateExpressionRepl,
  evaluateQueryRepl
} from "./language/tooling-repl.js";
import type { QueryDefinition, QueryRow } from "./language/typed-queries.js";
import { debugRequest } from "./language/debugger.js";
import {
  codeActions,
  documentSymbols,
  languageDiagnostics,
  semanticTokens,
  traceLinks
} from "./language/language-service.js";
import { validateBackendParity } from "./language/backend-parity.js";
import type { ConformanceCategory } from "./language/contracts.js";

const [command, sourceArgument, ...options] = process.argv.slice(2);

if (command === "lsp") {
  await import("./language/lsp-server.js");
} else if (command === "conformance" && sourceArgument === "run") {
  await runConformanceCommand(options);
} else if (command === "manifest" && sourceArgument === "validate") {
  await runManifestValidation(options);
} else if (command === "repl" && sourceArgument === "expression") {
  runExpressionRepl(options);
} else if (command === "repl" && sourceArgument === "query") {
  await runQueryRepl(options);
} else if (command === "debug" && sourceArgument !== undefined) {
  await runDebugger(sourceArgument, options);
} else if (command === "tooling" && sourceArgument !== undefined) {
  await runToolingInspection(sourceArgument);
} else if (command === "parity" && sourceArgument !== undefined) {
  await runParityCheck(sourceArgument);
} else if (command === "assurance" && sourceArgument === "report") {
  await runAssuranceReport(options);
} else if (command === "studio" && sourceArgument !== undefined) {
  await runStudio(sourceArgument, options);
} else if (command === "visual" && sourceArgument !== undefined) {
  const sourcePath = resolve(sourceArgument);
  const result = compileEnglishSource(await readFile(sourcePath, "utf8"));
  if (!result.ok) {
    printDiagnostics(sourcePath, result.diagnostics);
    process.exitCode = 1;
  } else if (findOptionValue(options, "--output") !== undefined &&
      resolve(findOptionValue(options, "--output")!) === sourcePath) {
    console.error("Visual output must not overwrite its source file.");
    process.exitCode = 2;
  } else {
    await writeCompiledOutput(result.html, "visual", options);
  }

} else if (
  (command !== "check" &&
    command !== "compile" &&
    command !== "generate" &&
    command !== "format") ||
  sourceArgument === undefined
) {
  printUsage();
  process.exitCode = 2;
} else if (command === "generate") {
  await runGenerate(sourceArgument, options);
} else if (command === "format") {
  await runFormat(sourceArgument, options);
} else {
  await runCompile(command, sourceArgument, options);
}

function toolingJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === "bigint" ? `${item}n` : item),
    2
  );
}

async function runConformanceCommand(options: string[]): Promise<void> {
  const category = findOptionValue(options, "--category");
  const rule = findOptionValue(options, "--rule");
  const result = await runConformance({
    categories: category
      ? (category.split(",") as ConformanceCategory[])
      : undefined,
    ruleIds: rule ? rule.split(",") : undefined
  });
  console.log(toolingJson(result));
  if (!result.passed) process.exitCode = 1;
}

async function runManifestValidation(options: string[]): Promise<void> {
  const manifestPath = options[0];
  if (!manifestPath || manifestPath.startsWith("--")) {
    console.error("manifest validate requires a manifest JSON path.");
    process.exitCode = 2;
    return;
  }
  const dependenciesPath = findOptionValue(options, "--dependencies");
  const dependencies = dependenciesPath
    ? (JSON.parse(await readFile(resolve(dependenciesPath), "utf8")) as Record<
        string,
        string
      >)
    : {};
  const manifest = JSON.parse(
    await readFile(resolve(manifestPath), "utf8")
  ) as unknown;
  const result = validateSemanticManifest(manifest, dependencies);
  console.log(toolingJson(result));
  if (!result.valid) process.exitCode = 1;
}

function runExpressionRepl(options: string[]): void {
  const expression = options[0];
  if (!expression || expression.startsWith("--")) {
    console.error("repl expression requires an expression string.");
    process.exitCode = 2;
    return;
  }

  try {
    console.log(toolingJson(evaluateExpressionRepl({ expression })));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function reviveToolingValue(value: unknown): any {
  if (typeof value === "string" && /^-?\d+n$/.test(value)) {
    return BigInt(value.slice(0, -1));
  }
  if (Array.isArray(value)) return value.map(reviveToolingValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        reviveToolingValue(item)
      ])
    );
  }
  return value;
}

async function runQueryRepl(options: string[]): Promise<void> {
  const inputPath = options[0];
  if (!inputPath || inputPath.startsWith("--")) {
    console.error("repl query requires a query JSON path.");
    process.exitCode = 2;
    return;
  }
  const input = reviveToolingValue(
    JSON.parse(await readFile(resolve(inputPath), "utf8"))
  ) as {
    definition: QueryDefinition;
    rows: Record<string, QueryRow[]>;
    authorization?: Record<string, { field: string; equals: unknown }>;
  };
  const result = evaluateQueryRepl({
    definition: input.definition,
    context: {
      rows: input.rows,
      authorize: (sourceName, row) => {
        const rule = input.authorization?.[sourceName];
        return rule === undefined || row[rule.field] === rule.equals;
      }
    }
  });
  console.log(toolingJson(result));
}

async function runDebugger(
  sourceArgument: string,
  options: string[]
): Promise<void> {
  const requestPath = findOptionValue(options, "--request");
  if (!requestPath) {
    console.error("debug requires --request <request.json>.");
    process.exitCode = 2;
    return;
  }
  const result = await compileProject(resolve(sourceArgument));
  if (!result.ok) {
    printDiagnostics(resolve(sourceArgument), result.diagnostics);
    process.exitCode = 1;
    return;
  }
  const request = JSON.parse(
    await readFile(resolve(requestPath), "utf8")
  ) as Parameters<typeof debugRequest>[1];
  console.log(toolingJson(debugRequest(result.ir, request)));
}

async function runToolingInspection(sourceArgument: string): Promise<void> {
  const sourcePath = resolve(sourceArgument);
  const source = await readFile(sourcePath, "utf8");
  console.log(
    toolingJson({
      diagnostics: languageDiagnostics(source),
      symbols: documentSymbols(source),
      codeActions: codeActions(source),
      semanticTokens: semanticTokens(source),
      trace: traceLinks(source, sourcePath)
    })
  );
}

async function runParityCheck(sourceArgument: string): Promise<void> {
  const result = await compileProject(resolve(sourceArgument));
  if (!result.ok) {
    printDiagnostics(resolve(sourceArgument), result.diagnostics);
    process.exitCode = 1;
    return;
  }
  const parity = validateBackendParity(result.ir);
  console.log(toolingJson(parity));
  if (!parity.valid) process.exitCode = 1;
}

async function runCompile(
  command: "check" | "compile",
  sourceArgument: string,
  options: string[]
): Promise<void> {
  const sourcePath = resolve(sourceArgument);
  const result = await compileProject(sourcePath, {
    verifyLock: !options.includes("--write-lock")
  });

  if (!result.ok) {
    printDiagnostics(sourcePath, result.diagnostics);
    process.exitCode = 1;
    return;
  }

  if (command === "check") {
    const relationshipCount = result.ir.relationships.length;
    const actionCount = result.ir.actions.length;
    const authEnabled = result.ir.authentication !== undefined;
    console.log("IntentLang plan");
    console.log(`  Application: ${result.ir.application.name}`);
    console.log(`  Entities: ${result.ir.entities.length}`);
    console.log(
      `  Fields: ${result.ir.entities.reduce(
        (total, entity) => total + entity.fields.length,
        0
      )}`
    );
    console.log(`  Relationships: ${relationshipCount}`);
    console.log(`  Actions: ${actionCount}`);
    console.log(`  Authentication: ${authEnabled ? "enabled" : "disabled"}`);
    console.log(`  Roles: ${result.ir.roles.length}`);
    console.log(`  Permissions: ${result.ir.permissions.length}`);
    console.log("  Diagnostics: 0");
    if (options.includes("--write-lock")) {
      const lockPath = sourcePath.replace(/\.intent$/i, ".lock.json");
      await writeFile(lockPath, result.lock, "utf8");
      console.log(`  Lock: ${lockPath}`);
    }
    return;
  }

  await writeCompiledOutput(result.output, "compile", options);
}

async function runAssuranceReport(options: string[]): Promise<void> {
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

  if (options.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("IntentLang language assurance");
    console.log(`  Language version: ${registry.languageVersion}`);
    console.log(`  Registry files: ${registry.files.length}`);
    console.log(`  Stable rules: ${report.stableRules}`);
    console.log(`  Conformance fixtures: ${fixtures.length}`);
    console.log(
      `  Stable inventory coverage: ${report.coveredInventoryEntries}/${report.stableInventoryEntries}`
    );
    console.log(
      `  Stable rules without fixtures: ${report.rulesWithoutFixtures.length}`
    );
    console.log(
      `  Fixtures with unknown rules: ${report.fixturesWithUnknownRules.length}`
    );
    if (report.uncoveredInventoryIds.length > 0) {
      console.log("  Uncovered inventory:");
      for (const id of report.uncoveredInventoryIds) {
        console.log(`    ${id}`);
      }
    }
  }

  const invalid =
    report.rulesWithoutFixtures.length > 0 ||
    report.fixturesWithUnknownRules.length > 0;
  const incomplete =
    options.includes("--require-complete") &&
    report.uncoveredInventoryIds.length > 0;
  if (invalid || incomplete) {
    process.exitCode = 1;
  }
}

async function writeCompiledOutput(output: string, command: string, options: string[]): Promise<void> {
  const outputArgument = findOptionValue(options, "--output");
  const doWrite = options.includes("--write");
  const force = options.includes("--force");

  if (force && !doWrite) {
    console.error("--force requires --write.");
    process.exitCode = 2;
    return;
  }

  if (outputArgument === undefined) {
    if (doWrite) {
      console.error(`${command} requires --output <path> when --write is supplied.`);
      process.exitCode = 2;
      return;
    }
    process.stdout.write(output);
    return;
  }

  if (!doWrite) {
    console.error("Refusing to write generated output without the explicit --write flag.");
    process.exitCode = 2;
    return;
  }

  const outputPath = resolve(outputArgument);
  if (existsSync(outputPath) && !force) {
    console.error(`Refusing to overwrite ${outputPath}. Use --force after reviewing the plan.`);
    process.exitCode = 2;
    return;
  }

  await writeFile(outputPath, output, "utf8");
  console.log(`Wrote: ${outputPath}`);
}

async function runGenerate(
  sourceArgument: string,
  options: string[]
): Promise<void> {
  const sourcePath = resolve(sourceArgument);
  const result = await compileProject(sourcePath, {
    verifyLock: !options.includes("--write-lock")
  });

  if (!result.ok) {
    printDiagnostics(sourcePath, result.diagnostics);
    process.exitCode = 1;
    return;
  }

  const outputArgument = findOptionValue(options, "--output");
  if (!outputArgument) {
    console.error("generate requires --output <directory>.");
    process.exitCode = 2;
    return;
  }

  const doWrite = options.includes("--write");
  const force = options.includes("--force");
  const allowDataLoss = options.includes("--allow-data-loss");
  const allowSecurityDowngrade = options.includes("--allow-security-downgrade");
  if (force && !doWrite) {
    console.error("--force requires --write.");
    process.exitCode = 2;
    return;
  }

  const outputDir = resolve(outputArgument);
  const schema = generateSchema(result.ir);
  const manifest = buildManifest(result.ir, result.dependencies);
  const manifestPath = `${outputDir}\\intentlang.manifest.json`;
  let previousManifest: BuildManifest | undefined;

  if (existsSync(manifestPath)) {
    try {
      previousManifest = JSON.parse(await readFile(manifestPath, "utf8")) as BuildManifest;
    } catch {
      console.error(`Could not read previous manifest at ${manifestPath}.`);
      process.exitCode = 1;
      return;
    }
  }

  if (previousManifest) {
    if (previousManifest.irFingerprint === manifest.irFingerprint) {
      console.log("Schema plan: no changes detected.");
    } else {
      const plan = planMigration(previousManifest, result.ir);
      console.log("Schema plan:");
      for (const item of plan.items) {
        const tag = item.destructive ? "[DESTRUCTIVE]" : "[ok]";
        console.log(`  ${tag} ${item.description}`);
        if (item.migrationSql) {
          console.log(`    SQL: ${item.migrationSql}`);
        }
        if (item.migrationNote) {
          console.log(`    Note: ${item.migrationNote}`);
        }
      }
      if (plan.isDestructive && !allowDataLoss) {
        console.error("\nRefusing to generate: destructive changes detected. Supply --allow-data-loss to proceed.");
        process.exitCode = 1;
        return;
      }
      if (plan.isSecurityDestructive && !allowSecurityDowngrade) {
        console.error("Refusing to generate: security-destructive changes detected. Supply --allow-security-downgrade to proceed.");
        process.exitCode = 1;
        return;
      }
    }
  } else {
    console.log("Schema plan: initial generation (no previous manifest).");
  }

  if (!doWrite) {
    console.log("\n(Plan only — pass --write to generate artifacts.)");
    return;
  }

  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  const appMjsPath = `${outputDir}\\app.mjs`;
  const migrationPath = `${outputDir}\\migration.sql`;
  const packageJsonPath = `${outputDir}\\package.json`;
  const indexHtmlPath = `${outputDir}\\index.html`;
  const appJsPath = `${outputDir}\\app.js`;
  const stylesCssPath = `${outputDir}\\styles.css`;
  const tracePath = `${outputDir}\\intentlang.trace.json`;
  const lockPath = `${outputDir}\\intentlang.lock.json`;

  for (const outputPath of [appMjsPath, migrationPath, packageJsonPath, indexHtmlPath, appJsPath, stylesCssPath, tracePath, lockPath]) {
    if (existsSync(outputPath) && !force) {
      console.error(`Refusing to overwrite ${outputPath}. Use --force after reviewing the plan.`);
      process.exitCode = 2;
      return;
    }
  }

  const ui = generateUi(result.ir);
  const runtime = generateRuntime(result.ir, manifest, ui);

  await writeFile(appMjsPath, runtime.appMjs, "utf8");
  await writeFile(migrationPath, schema.migrationSql, "utf8");
  await writeFile(manifestPath, canonicalJson(manifest) + "\n", "utf8");
  await writeFile(packageJsonPath, runtime.packageJson, "utf8");
  await writeFile(indexHtmlPath, ui.indexHtml, "utf8");
  await writeFile(appJsPath, ui.appJs, "utf8");
  await writeFile(stylesCssPath, ui.stylesCss, "utf8");
  await writeFile(
    tracePath,
    canonicalJson(
      remapTraceMapSources(
        buildTraceMap(result.source, result.ir, sourcePath),
        result.sourceMap
      )
    ) + "\n",
    "utf8"
  );
  await writeFile(lockPath, result.lock, "utf8");
  if (options.includes("--write-lock")) {
    await writeFile(
      sourcePath.replace(/\.intent$/i, ".lock.json"),
      result.lock,
      "utf8"
    );
  }

  console.log(`\nGenerated artifacts in ${outputDir}:`);
  console.log("  app.mjs");
  console.log("  migration.sql");
  console.log("  intentlang.manifest.json");
  console.log("  package.json");
  console.log("  index.html");
  console.log("  app.js");
  console.log("  styles.css");
  console.log("  intentlang.trace.json");
  console.log("  intentlang.lock.json");
  console.log("  (app.sqlite preserved if it exists)");
}

async function runFormat(
  sourceArgument: string,
  options: string[]
): Promise<void> {
  const sourcePath = resolve(sourceArgument);
  const result = await compileProject(sourcePath);

  if (!result.ok) {
    printDiagnostics(sourcePath, result.diagnostics);
    process.exitCode = 1;
    return;
  }

  const formatted = formatSource(result.ir);
  const outputArgument = findOptionValue(options, "--output");
  const doWrite = options.includes("--write");
  const force = options.includes("--force");

  if (result.modules.length > 0 && doWrite && outputArgument === undefined) {
    console.error(
      "Refusing to replace a modular entry file with flattened canonical source. Use --output <path>."
    );
    process.exitCode = 2;
    return;
  }

  if (force && !doWrite) {
    console.error("--force requires --write.");
    process.exitCode = 2;
    return;
  }

  if (outputArgument !== undefined) {
    if (!doWrite) {
      console.error("Refusing to write formatted output without the explicit --write flag.");
      process.exitCode = 2;
      return;
    }
    const outputPath = resolve(outputArgument);
    if (existsSync(outputPath) && !force) {
      console.error(`Refusing to overwrite ${outputPath}. Use --force after reviewing the plan.`);
      process.exitCode = 2;
      return;
    }
    await writeFile(outputPath, formatted, "utf8");
    console.log(`Formatted: ${outputPath}`);
    return;
  }

  if (doWrite) {
    await writeFile(sourcePath, formatted, "utf8");
    console.log(`Formatted: ${sourcePath}`);
    return;
  }

  process.stdout.write(formatted);
}

function printDiagnostics(
  sourcePath: string,
  diagnostics: Array<{ file?: string; line: number; column: number; code: string; message: string; hint: string }>
): void {
  for (const diagnostic of diagnostics) {
    console.error(`${diagnostic.file ?? sourcePath}:${diagnostic.line}:${diagnostic.column} ${diagnostic.code} ${diagnostic.message}`);
    console.error(`  Fix: ${diagnostic.hint}`);
  }
}

function findOptionValue(options: string[], name: string): string | undefined {
  const index = options.indexOf(name);
  return index >= 0 ? options[index + 1] : undefined;
}

function printUsage(): void {
  console.error("Usage:");
  console.error("  intentlang check <source> [--write-lock]");
  console.error("  intentlang compile <source> [--output <path> --write [--force]]");
  console.error("  intentlang visual <source> [--output <page.html> --write [--force]]");
  console.error("  intentlang format <source> [--write] [--output <path> --write [--force]]");
  console.error("  intentlang generate <source> --output <directory> [--write] [--force] [--write-lock] [--allow-data-loss] [--allow-security-downgrade]");
  console.error("  intentlang studio <source> [--port <number>] [--no-open]");
  console.error("    [--ai-provider none|ollama|openai-compatible|gemini]");
  console.error("    [--ai-model <model>] [--ai-endpoint <url>] [--ai-timeout <ms>]");
  console.error("    [--allow-remote-ai]");
  console.error("  intentlang assurance report [--json] [--require-complete]");
  console.error("  intentlang lsp");
  console.error("  intentlang tooling <source>");
  console.error("  intentlang repl expression \"<expression>\"");
  console.error("  intentlang repl query <query.json>");
  console.error("  intentlang debug <source> --request <request.json>");
  console.error("  intentlang conformance run [--category <categories>] [--rule <rule-ids>]");
  console.error("  intentlang manifest validate <manifest.json> [--dependencies <dependencies.json>]");
  console.error("  intentlang parity <source>");
  console.error("  API key (if needed): set env INTENTLANG_AI_API_KEY before starting Studio.");
}

async function runStudio(
  sourceArgument: string,
  options: string[]
): Promise<void> {
  const { startStudio } = await import("./studio-server.js");

  const sourcePath = resolve(sourceArgument);
  const portOption = findOptionValue(options, "--port");
  const noOpen = options.includes("--no-open");

  let port: number | undefined;
  if (portOption !== undefined) {
    const parsed = parseInt(portOption, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
      console.error("--port must be a number between 1 and 65535.");
      process.exitCode = 2;
      return;
    }
    port = parsed;
  }

  const envPort = process.env["PORT"];
  if (port === undefined && envPort !== undefined) {
    const parsed = parseInt(envPort, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 65535) {
      port = parsed;
    }
  }

  // AI flags (all optional; provider defaults to "none")
  const aiProviderRaw = findOptionValue(options, "--ai-provider") ?? "none";
  const validProviders = ["none", "ollama", "openai-compatible", "gemini"];
  if (!validProviders.includes(aiProviderRaw)) {
    console.error(`--ai-provider must be one of: ${validProviders.join(", ")}`);
    process.exitCode = 2;
    return;
  }

  const aiTimeoutRaw = findOptionValue(options, "--ai-timeout");
  let aiTimeout: number | undefined;
  if (aiTimeoutRaw !== undefined) {
    const t = parseInt(aiTimeoutRaw, 10);
    if (isNaN(t) || t < 1) {
      console.error("--ai-timeout must be a positive integer (milliseconds).");
      process.exitCode = 2;
      return;
    }
    aiTimeout = t;
  }

  const aiConfig = effectiveAiConfig({
    provider: aiProviderRaw as AiProviderKind,
    model: findOptionValue(options, "--ai-model") ?? "",
    endpoint: findOptionValue(options, "--ai-endpoint") ?? "",
    timeoutMs: aiTimeout,
    allowRemote: options.includes("--allow-remote-ai")
  });

  try {
    await startStudio({ sourcePath, port, noOpen, ai: aiConfig });

    if (!noOpen) {
      // Keep process alive until Ctrl+C
      await new Promise<never>(() => {});
    }
  } catch (err) {
    console.error(`Studio failed to start: ${String(err)}`);
    process.exitCode = 1;
  }
}
