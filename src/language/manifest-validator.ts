import type { BuildManifest, ProgramIr } from "../model.js";
import { canonicalJson } from "../compiler.js";
import { createHash } from "node:crypto";
import {
  buildSemanticManifest,
  dependencyFingerprint,
  LANGUAGE_VERSION
} from "./semantic-fingerprint.js";

export interface ManifestValidation {
  valid: boolean;
  errors: string[];
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export function validateSemanticManifest(
  value: unknown,
  dependencies: Record<string, string> = {}
): ManifestValidation {
  const errors: string[] = [];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, errors: ["Manifest must be an object."] };
  }
  const manifest = value as Partial<BuildManifest>;
  if (!manifest.ir || typeof manifest.ir !== "object") {
    return { valid: false, errors: ["Manifest.ir is required."] };
  }
  const ir = manifest.ir as ProgramIr;
  if (manifest.compilerVersion !== LANGUAGE_VERSION) {
    errors.push(`compilerVersion must be ${LANGUAGE_VERSION}.`);
  }
  const semantic = buildSemanticManifest(
    ir,
    manifest.compilerVersion ?? "",
    dependencies
  );
  const expectedIrFingerprint = sha256(canonicalJson(ir));
  const checks: Array<[keyof BuildManifest, unknown]> = [
    ["languageVersion", semantic.languageVersion],
    ["irVersion", semantic.irVersion],
    ["schemaVersion", ir.schemaVersion],
    ["sourceFingerprint", semantic.sourceFingerprint],
    ["semanticFingerprint", semantic.semanticFingerprint],
    ["dependencyFingerprint", dependencyFingerprint(dependencies)],
    ["irFingerprint", expectedIrFingerprint]
  ];
  for (const [key, expected] of checks) {
    if (manifest[key] !== expected) {
      errors.push(`${key} does not match the embedded IR and dependencies.`);
    }
  }
  if (
    manifest.generatorVersions === undefined ||
    JSON.stringify(manifest.generatorVersions) !==
      JSON.stringify(semantic.generatorVersions)
  ) {
    errors.push("generatorVersions do not match the language contract.");
  }
  return { valid: errors.length === 0, errors };
}
