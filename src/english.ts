import { compileVisualSource, type VisualCompileResult } from "./visual.js";
import { compilePageSource, type PageCompileResult } from "./web.js";
import { usesPageGrammar } from "./web-syntax.js";

export type EnglishCompileResult = VisualCompileResult | PageCompileResult;

export function compileEnglishSource(source: string): EnglishCompileResult {
  return usesPageGrammar(source) ? compilePageSource(source) : compileVisualSource(source);
}
