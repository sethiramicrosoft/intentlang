import type { CompileResult } from "./model.js";
import { parseSource } from "./parser.js";

export { formatSource } from "./formatter.js";

export function compileSource(source: string): CompileResult {
  const parsed = parseSource(source);

  if (!parsed.ir) {
    return {
      ok: false,
      diagnostics: parsed.diagnostics
    };
  }

  return {
    ok: true,
    ir: parsed.ir,
    output: `${canonicalJson(parsed.ir)}\n`
  };
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value), null, 2);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, nestedValue]) => [key, canonicalize(nestedValue)])
    );
  }

  return value;
}
