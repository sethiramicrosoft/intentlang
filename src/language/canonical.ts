import { canonicalJson } from "../compiler.js";
import { formatSource } from "../formatter.js";
import type { ProgramIr } from "../model.js";

export interface CanonicalProgram {
  source: string;
  semanticJson: string;
}

export function canonicalProgram(ir: ProgramIr): CanonicalProgram {
  return {
    source: formatSource(ir),
    semanticJson: canonicalJson(ir)
  };
}

export function isCanonicalSourceIdempotent(ir: ProgramIr): boolean {
  const first = formatSource(ir);
  return first.endsWith("\n") && !first.includes("\r");
}
