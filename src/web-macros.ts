// Compile-time only: variables, conditionals, and repetition, written as plain English
// sentences (no colons, no "end" keywords, no block syntax). Everything here is resolved
// before the page grammar ever sees the source, so a page still compiles to static HTML/CSS
// with no generated JavaScript.
import type { VisualDiagnostic } from "./visual.js";

export type MacroExpandResult =
  | { ok: true; source: string }
  | { ok: false; diagnostics: VisualDiagnostic[] };

const NUMBER_OR_NAME = "(?:the\\s+)?(-?\\d+(?:\\.\\d+)?|[a-z][a-z ]*?)";
const ASSIGN_RE = /^the\s+([a-z][a-z ]*?)\s+is\s+(.+?)\.?$/i;
const EXPR_RE = new RegExp(`^${NUMBER_OR_NAME}(?:\\s+(plus|minus|times|divided by)\\s+${NUMBER_OR_NAME})?$`, "i");
const IF_RE = /^if\s+the\s+([a-z][a-z ]*?)\s+is\s+(greater than|less than|equal to|at least|at most)\s+(?:the\s+)?(-?\d+(?:\.\d+)?|[a-z][a-z ]*?)\s*,\s*(.+?)\.?$/i;
const OTHERWISE_RE = /^otherwise\s*,\s*(.+?)\.?$/i;
// The list group is greedy so it claims everything up to the LAST comma (the one that
// separates the list from the instruction), letting "red, green and blue" stay intact.
const FOR_EACH_RE = /^for each\s+([a-z][a-z ]*?)\s+in\s+(.*)\s*,\s*(.+?)\.?$/i;

function splitEnglishList(text: string): string[] {
  const normalized = text.replace(/,?\s+and\s+(?=[^,]+$)/i, ", ");
  return normalized.split(",").map((item) => item.trim()).filter(Boolean);
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function resolveOperand(raw: string, variables: Map<string, number>): number | undefined {
  const token = raw.trim().toLowerCase();
  if (/^-?\d+(?:\.\d+)?$/.test(token)) return Number(token);
  return variables.get(token);
}

function evaluateExpression(expr: string, variables: Map<string, number>): number | undefined {
  const match = EXPR_RE.exec(expr.trim());
  if (!match) return undefined;
  const left = resolveOperand(match[1]!, variables);
  if (left === undefined) return undefined;
  if (!match[2]) return left;
  const right = resolveOperand(match[3]!, variables);
  if (right === undefined) return undefined;
  switch (match[2].toLowerCase()) {
    case "plus": return left + right;
    case "minus": return left - right;
    case "times": return left * right;
    case "divided by": return right === 0 ? undefined : left / right;
    default: return undefined;
  }
}

function compare(value: number, comparator: string, target: number): boolean {
  switch (comparator.toLowerCase()) {
    case "greater than": return value > target;
    case "less than": return value < target;
    case "equal to": return value === target;
    case "at least": return value >= target;
    case "at most": return value <= target;
    default: return false;
  }
}

function substituteWord(text: string, word: string, replacement: string): string {
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), replacement);
}

/** True if any line looks like a variable, conditional, or repetition sentence. */
export function usesMacroGrammar(source: string): boolean {
  return source.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    return ASSIGN_RE.test(trimmed) || IF_RE.test(trimmed) || OTHERWISE_RE.test(trimmed) || FOR_EACH_RE.test(trimmed);
  });
}

/**
 * Expands "The X is Y.", "If the X is ..., ...", "Otherwise, ...", and
 * "For each X in ..., ..." into plain page-grammar instructions. Each sentence carries
 * exactly one instruction (no "and"-chained actions, no nesting) so the grammar stays
 * unambiguous while still reading as ordinary English.
 */
export function expandMacros(source: string): MacroExpandResult {
  const lines = source.split(/\r?\n/);
  const variables = new Map<string, number>();
  const output: string[] = [];
  const diagnostics: VisualDiagnostic[] = [];
  let lastCondition: boolean | undefined;

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const trimmed = rawLine.trim();
    if (!trimmed) { output.push(rawLine); return; }

    const assign = ASSIGN_RE.exec(trimmed);
    if (assign) {
      const value = evaluateExpression(assign[2]!, variables);
      if (value !== undefined) {
        variables.set(assign[1]!.trim().toLowerCase(), value);
        return; // a variable sentence does not render anything by itself
      }
      // Doesn't resolve to a known number or variable expression: leave it for the
      // page compiler to report as an ordinary unrecognized instruction.
      output.push(rawLine);
      return;
    }

    const ifMatch = IF_RE.exec(trimmed);
    if (ifMatch) {
      const name = ifMatch[1]!.trim().toLowerCase();
      const value = variables.get(name);
      if (value === undefined) {
        diagnostics.push({
          code: "M001", category: "syntax", line: lineNumber, column: 1, length: trimmed.length,
          message: `"${ifMatch[1]!.trim()}" was never given a value.`,
          hint: `Add a sentence like "The ${ifMatch[1]!.trim()} is 0." before this line.`,
        });
        return;
      }
      const target = resolveOperand(ifMatch[3]!, variables);
      if (target === undefined) {
        diagnostics.push({
          code: "M002", category: "syntax", line: lineNumber, column: 1, length: trimmed.length,
          message: `"${ifMatch[3]!.trim()}" is not a number or a known variable.`,
          hint: `Compare "${ifMatch[1]!.trim()}" to a number or to a variable defined earlier.`,
        });
        return;
      }
      lastCondition = compare(value, ifMatch[2]!, target);
      if (lastCondition) output.push(ifMatch[4]!);
      return;
    }

    const otherwise = OTHERWISE_RE.exec(trimmed);
    if (otherwise) {
      if (lastCondition === undefined) {
        diagnostics.push({
          code: "M003", category: "syntax", line: lineNumber, column: 1, length: trimmed.length,
          message: `"Otherwise" must come right after an "If" sentence.`,
          hint: `Add an "If the ... is ..., ..." sentence before this line.`,
        });
        return;
      }
      if (!lastCondition) output.push(otherwise[1]!);
      return;
    }

    const forEach = FOR_EACH_RE.exec(trimmed);
    if (forEach) {
      const loopVar = forEach[1]!.trim();
      const items = splitEnglishList(forEach[2]!);
      if (items.length === 0) {
        diagnostics.push({
          code: "M004", category: "syntax", line: lineNumber, column: 1, length: trimmed.length,
          message: `"For each ${loopVar} in ..." needs at least one item in its list.`,
          hint: `List one or more items, such as "For each ${loopVar} in red, green and blue, ...".`,
        });
        return;
      }
      for (const item of items) output.push(substituteWord(forEach[3]!, loopVar, item));
      return;
    }

    output.push(rawLine);
  });

  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const finalLines = output.map((line) => {
    const trailing = /^(.*\bto\s+)([a-z][a-z ]*)$/i.exec(line.trimEnd());
    if (!trailing) return line;
    const name = trailing[2]!.trim().toLowerCase();
    if (!variables.has(name)) return line;
    return `${trailing[1]}${formatNumber(variables.get(name)!)}`;
  });

  return { ok: true, source: finalLines.join("\n") };
}
