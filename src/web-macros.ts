// Compile-time only: variables, conditionals, and repetition, written as plain English
// sentences (no colons, no "end" keywords, no block syntax). Everything here is resolved
// before the page grammar ever sees the source, so a page still compiles to static HTML/CSS
// with no generated JavaScript.
import { oneEditAway, type VisualDiagnostic, type VisualSuggestion } from "./visual.js";

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
const COMPARATORS = ["greater than", "less than", "equal to", "at least", "at most"];

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

/** Closest known variable name to an unresolved reference, for a "did you mean" suggestion. */
function closestVariable(name: string, variables: Map<string, number>): string | undefined {
  const key = name.trim().toLowerCase();
  for (const known of variables.keys()) if (oneEditAway(known, key)) return known;
  return undefined;
}

/** A single word (or, for comparators, a two-word phrase) that is one edit away from a known
 * keyword but is not that keyword. Used only to power "did you mean" suggestions, never applied
 * automatically. */
function closestKeyword(word: string, candidates: string[]): string | undefined {
  const key = word.trim().toLowerCase();
  if (candidates.includes(key)) return undefined;
  return candidates.find((candidate) => oneEditAway(candidate, key));
}

/**
 * Looks for exactly one fixable spelling mistake (a keyword, a connector word like "is"/"in", or
 * a comparator phrase) that would turn an unrecognized line into a valid variable, If, Otherwise,
 * or For each sentence. This mirrors how the page compiler suggests element/style/attribute
 * corrections elsewhere: it never applies a fix silently, only offers it as a clickable
 * suggestion in the IDE so the person writing English stays in control.
 */
function suggestMacroFix(trimmed: string): VisualSuggestion | undefined {
  const theWord = /^(\S+)(\s+[a-z][a-z ]*?\s+\S+\s+.+)$/i.exec(trimmed);
  if (theWord) {
    const fixed = closestKeyword(theWord[1]!, ["the"]);
    if (fixed) {
      const corrected = `the${theWord[2]}`;
      if (ASSIGN_RE.test(corrected)) return { label: `Change "${theWord[1]}" to "the"`, replacement: corrected };
    }
  }
  const assignWord = /^(the\s+[a-z][a-z ]*?\s+)(\S+)(\s+.+)$/i.exec(trimmed);
  if (assignWord) {
    const fixed = closestKeyword(assignWord[2]!, ["is"]);
    if (fixed) {
      const corrected = `${assignWord[1]}is${assignWord[3]}`;
      if (ASSIGN_RE.test(corrected)) return { label: `Change "${assignWord[2]}" to "is"`, replacement: corrected };
    }
  }
  const ifWord = /^(\S+)(\s+the\s+.+)$/i.exec(trimmed);
  if (ifWord) {
    const fixed = closestKeyword(ifWord[1]!, ["if"]);
    if (fixed) {
      const corrected = `if${ifWord[2]}`;
      if (IF_RE.test(corrected)) return { label: `Change "${ifWord[1]}" to "if"`, replacement: corrected };
    }
  }
  const otherwiseWord = /^(\S+)(\s*,\s*.+)$/i.exec(trimmed);
  if (otherwiseWord) {
    const fixed = closestKeyword(otherwiseWord[1]!, ["otherwise"]);
    if (fixed) {
      const corrected = `otherwise${otherwiseWord[2]}`;
      if (OTHERWISE_RE.test(corrected)) return { label: `Change "${otherwiseWord[1]}" to "otherwise"`, replacement: corrected };
    }
  }
  const forWord = /^(\S+)(\s+each\s+.+)$/i.exec(trimmed);
  if (forWord) {
    const fixed = closestKeyword(forWord[1]!, ["for"]);
    if (fixed) {
      const corrected = `for${forWord[2]}`;
      if (FOR_EACH_RE.test(corrected)) return { label: `Change "${forWord[1]}" to "for"`, replacement: corrected };
    }
  }
  const inWord = /^(for\s+each\s+[a-z][a-z ]*?\s+)(\S+)(\s+.+)$/i.exec(trimmed);
  if (inWord) {
    const fixed = closestKeyword(inWord[2]!, ["in"]);
    if (fixed) {
      const corrected = `${inWord[1]}in${inWord[3]}`;
      if (FOR_EACH_RE.test(corrected)) return { label: `Change "${inWord[2]}" to "in"`, replacement: corrected };
    }
  }
  const comparatorPhrase = /^(if\s+the\s+[a-z][a-z ]*?\s+is\s+)([a-z]+\s+[a-z]+)(\s+(?:the\s+)?(?:-?\d+(?:\.\d+)?|[a-z][a-z ]*?)\s*,\s*.+)$/i
    .exec(trimmed);
  if (comparatorPhrase) {
    const fixed = closestKeyword(comparatorPhrase[2]!, COMPARATORS);
    if (fixed) {
      const corrected = `${comparatorPhrase[1]}${fixed}${comparatorPhrase[3]}`;
      if (IF_RE.test(corrected)) return { label: `Change "${comparatorPhrase[2]}" to "${fixed}"`, replacement: corrected };
    }
  }
  return undefined;
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
  function report(lineNumber: number, trimmed: string, code: string, message: string, hint: string,
    suggestions?: VisualSuggestion[]) {
    diagnostics.push({
      code, category: suggestions?.length ? "typo" : "syntax", line: lineNumber, column: 1, length: trimmed.length,
      message, hint, ...(suggestions?.length ? { suggestions } : {})
    });
  }

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
        const closest = closestVariable(ifMatch[1]!, variables);
        report(lineNumber, trimmed, "M001", `"${ifMatch[1]!.trim()}" was never given a value.`,
          closest ? `Did you mean "${closest}"?` : `Add a sentence like "The ${ifMatch[1]!.trim()} is 0." before this line.`,
          closest ? [{ label: `Use "${closest}"`, replacement: rawLine.replace(ifMatch[1]!, closest) }] : undefined);
        return;
      }
      const target = resolveOperand(ifMatch[3]!, variables);
      if (target === undefined) {
        const closest = closestVariable(ifMatch[3]!, variables);
        report(lineNumber, trimmed, "M002", `"${ifMatch[3]!.trim()}" is not a number or a known variable.`,
          closest ? `Did you mean "${closest}"?` : `Compare "${ifMatch[1]!.trim()}" to a number or to a variable defined earlier.`,
          closest ? [{ label: `Use "${closest}"`, replacement: rawLine.replace(ifMatch[3]!, closest) }] : undefined);
        return;
      }
      lastCondition = compare(value, ifMatch[2]!, target);
      if (lastCondition) output.push(ifMatch[4]!);
      return;
    }

    const otherwise = OTHERWISE_RE.exec(trimmed);
    if (otherwise) {
      if (lastCondition === undefined) {
        report(lineNumber, trimmed, "M003", `"Otherwise" must come right after an "If" sentence.`,
          `Add an "If the ... is ..., ..." sentence before this line.`);
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
        report(lineNumber, trimmed, "M004", `"For each ${loopVar} in ..." needs at least one item in its list.`,
          `List one or more items, such as "For each ${loopVar} in red, green and blue, ...".`);
        return;
      }
      for (const item of items) output.push(substituteWord(forEach[3]!, loopVar, item));
      return;
    }

    const fix = suggestMacroFix(trimmed);
    if (fix) {
      report(lineNumber, trimmed, "M005", `This line looks like it was meant to be a variable, If, Otherwise, or For each sentence, but has a spelling mistake.`,
        fix.label, [fix]);
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

