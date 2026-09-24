import { createHash } from "node:crypto";
import { canonicalJson } from "../compiler.js";
import { formatSource } from "../formatter.js";
import type { ProgramIr } from "../model.js";
import type { SemanticManifest } from "./contracts.js";

export const LANGUAGE_VERSION = "0.8.0-alpha.0";
export const GENERATOR_VERSIONS = {
  database: "0.8.0-alpha.0",
  runtime: "0.8.0-alpha.0",
  ui: "0.8.0-alpha.0"
} as const;

export function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export function sourceFingerprint(ir: ProgramIr): string {
  return sha256(formatSource(ir));
}

export function semanticFingerprint(ir: ProgramIr): string {
  return sha256(canonicalJson(ir));
}

export function dependencyFingerprint(
  dependencies: Record<string, string> = {}
): string {
  return sha256(canonicalJson(dependencies));
}

export function artifactFingerprint(
  artifacts: Record<string, string | Uint8Array>
): string {
  const encoded = Object.fromEntries(
    Object.entries(artifacts)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([path, content]) => [
        path,
        typeof content === "string"
          ? sha256(content)
          : `sha256:${createHash("sha256").update(content).digest("hex")}`
      ])
  );
  return sha256(canonicalJson(encoded));
}

export function buildSemanticManifest(
  ir: ProgramIr,
  compilerVersion: string,
  dependencies: Record<string, string> = {}
): SemanticManifest {
  return {
    languageVersion: LANGUAGE_VERSION,
    irVersion: ir.schemaVersion,
    compilerVersion,
    sourceFingerprint: sourceFingerprint(ir),
    semanticFingerprint: semanticFingerprint(ir),
    dependencyFingerprint: dependencyFingerprint(dependencies),
    generatorVersions: { ...GENERATOR_VERSIONS }
  };
}
