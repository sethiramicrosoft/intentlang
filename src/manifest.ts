import { createHash } from "node:crypto";
import { canonicalJson } from "./compiler.js";
import type { BuildManifest, ProgramIr } from "./model.js";

export const COMPILER_VERSION = "0.8.0-alpha.0";

export function buildManifest(ir: ProgramIr): BuildManifest {
  const irJson = canonicalJson(ir);
  const fingerprint =
    "sha256:" + createHash("sha256").update(irJson, "utf8").digest("hex");

  return {
    compilerVersion: COMPILER_VERSION,
    schemaVersion: ir.schemaVersion,
    ir,
    irFingerprint: fingerprint
  };
}
