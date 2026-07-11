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

const [command, sourceArgument, ...options] = process.argv.slice(2);

if (command === "studio" && sourceArgument !== undefined) {
  await runStudio(sourceArgument, options);
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

async function runCompile(
  command: "check" | "compile",
  sourceArgument: string,
  options: string[]
): Promise<void> {
  const sourcePath = resolve(sourceArgument);
  const source = await readFile(sourcePath, "utf8");
  const result = compileSource(source);

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
    return;
  }

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
      console.error("compile requires --output <path> when --write is supplied.");
      process.exitCode = 2;
      return;
    }
    process.stdout.write(result.output);
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

  await writeFile(outputPath, result.output, "utf8");
  console.log(`Wrote: ${outputPath}`);
}

async function runGenerate(
  sourceArgument: string,
  options: string[]
): Promise<void> {
  const sourcePath = resolve(sourceArgument);
  const source = await readFile(sourcePath, "utf8");
  const result = compileSource(source);

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
  const manifest = buildManifest(result.ir);
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

  for (const outputPath of [appMjsPath, migrationPath, packageJsonPath, indexHtmlPath, appJsPath, stylesCssPath]) {
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

  console.log(`\nGenerated artifacts in ${outputDir}:`);
  console.log("  app.mjs");
  console.log("  migration.sql");
  console.log("  intentlang.manifest.json");
  console.log("  package.json");
  console.log("  index.html");
  console.log("  app.js");
  console.log("  styles.css");
  console.log("  (app.sqlite preserved if it exists)");
}

async function runFormat(
  sourceArgument: string,
  options: string[]
): Promise<void> {
  const sourcePath = resolve(sourceArgument);
  const source = await readFile(sourcePath, "utf8");
  const result = compileSource(source);

  if (!result.ok) {
    printDiagnostics(sourcePath, result.diagnostics);
    process.exitCode = 1;
    return;
  }

  const formatted = formatSource(result.ir);
  const outputArgument = findOptionValue(options, "--output");
  const doWrite = options.includes("--write");
  const force = options.includes("--force");

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
  diagnostics: Array<{ line: number; column: number; code: string; message: string; hint: string }>
): void {
  for (const diagnostic of diagnostics) {
    console.error(`${sourcePath}:${diagnostic.line}:${diagnostic.column} ${diagnostic.code} ${diagnostic.message}`);
    console.error(`  Fix: ${diagnostic.hint}`);
  }
}

function findOptionValue(options: string[], name: string): string | undefined {
  const index = options.indexOf(name);
  return index >= 0 ? options[index + 1] : undefined;
}

function printUsage(): void {
  console.error("Usage:");
  console.error("  intentlang check <source>");
  console.error("  intentlang compile <source> [--output <path> --write [--force]]");
  console.error("  intentlang format <source> [--write] [--output <path> --write [--force]]");
  console.error("  intentlang generate <source> --output <directory> [--write] [--force] [--allow-data-loss] [--allow-security-downgrade]");
  console.error("  intentlang studio <source> [--port <number>] [--no-open]");
  console.error("    [--ai-provider none|ollama|openai-compatible]");
  console.error("    [--ai-model <model>] [--ai-endpoint <url>] [--ai-timeout <ms>]");
  console.error("    [--allow-remote-ai]");
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
  const validProviders = ["none", "ollama", "openai-compatible"];
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
