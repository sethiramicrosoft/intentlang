import type { CompileResult } from "./model.js";
import { parseSource } from "./parser.js";
import { expandPolicySource } from "./language/policies.js";
import { expandDeclarationSource } from "./language/abstractions.js";

export { formatSource } from "./formatter.js";

export function compileSource(source: string): CompileResult {
  const declarations = expandDeclarationSource(source);
  if (!declarations.ok) {
    return { ok: false, diagnostics: declarations.diagnostics };
  }
  const expanded = expandPolicySource(declarations.source);
  if (!expanded.ok) {
    return { ok: false, diagnostics: expanded.diagnostics };
  }
  const parsed = parseSource(expanded.source);

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
