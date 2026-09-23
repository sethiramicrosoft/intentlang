import { compileVisualSource, type VisualCompileResult } from "./visual.js";
import { compilePageSource, type PageCompileResult } from "./web.js";
import { usesPageGrammar } from "./web-syntax.js";
import { expandMacros } from "./web-macros.js";

export type EnglishCompileResult = VisualCompileResult | PageCompileResult;

export function compileEnglishSource(source: string): EnglishCompileResult {
  if (!usesPageGrammar(source)) return compileVisualSource(source);
  const expanded = expandMacros(source);
  if (!expanded.ok) return { ok: false, diagnostics: expanded.diagnostics };
  return compilePageSource(expanded.source);
}
