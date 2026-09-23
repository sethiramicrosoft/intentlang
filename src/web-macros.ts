// Compile-time only: variables, conditionals, and repetition, written as plain English
// sentences (no colons, no "end" keywords, no block syntax). Everything here is resolved
// before the page grammar ever sees the source, so a page still compiles to static HTML/CSS
// with no generated JavaScript.
import { oneEditAway, type VisualDiagnostic, type VisualSuggestion } from "./visual.js";

export type MacroExpandResult =
  | { ok: true; source: string }
  | { ok: false; diagnostics: VisualDiagnostic[] };

/** A variable holds either a number (with arithmetic) or plain text (copied or compared, but
 * not computed). Both kinds are written the same way: "The <name> is <value>." */
type VarValue = { type: "number"; value: number } | { type: "text"; value: string };

const NUMBER_OR_NAME = "(?:the\\s+)?(-?\\d+(?:\\.\\d+)?|[a-z][a-z ]*?)";
const ASSIGN_RE = /^the\s+([a-z][a-z ]*?)\s+is\s+(.+?)\.?$/i;
const EXPR_RE = new RegExp(`^${NUMBER_OR_NAME}(?:\\s+(plus|minus|times|divided by)\\s+${NUMBER_OR_NAME})?$`, "i");
const NUMERIC_INTENT_RE = /\d|\b(?:plus|minus|times|divided by)\b/i;
const IF_RE = /^if\s+the\s+([a-z][a-z ]*?)\s+is\s+(greater than|less than|not equal to|equal to|at least|at most)\s+(?:the\s+)?(-?\d+(?:\.\d+)?|[a-z][a-z ]*?)\s*,\s*(.+?)\.?$/i;
const OTHERWISE_RE = /^otherwise\s*,\s*(.+?)\.?$/i;
// The list group is greedy so it claims everything up to the LAST comma (the one that
// separates the list from the instruction), letting "red, green and blue" stay intact.
const FOR_EACH_RE = /^for each\s+([a-z][a-z ]*?)\s+in\s+(.*)\s*,\s*(.+?)\.?$/i;
const COMPARATORS = ["greater than", "less than", "not equal to", "equal to", "at least", "at most"];
// Multiple instructions in one If/Otherwise/For each sentence are chained with "and then",
// a phrase that reads naturally and never collides with ordinary instruction text (unlike a
// bare "and", which can legitimately appear inside a list or a piece of display text).
const AND_THEN_RE = /\s+and\s+then\s+/i;

function splitInstructions(text: string): string[] {
  return text.split(AND_THEN_RE).map((part) => part.trim()).filter(Boolean);
}

function splitEnglishList(text: string): string[] {
  const normalized = text.replace(/,?\s+and\s+(?=[^,]+$)/i, ", ");
  return normalized.split(",").map((item) => item.trim()).filter(Boolean);
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function stripLeadingThe(text: string): string {
  return text.trim().replace(/^the\s+/i, "");
}

function dequote(text: string): string {
  return /^"([\s\S]*)"$/.exec(text.trim())?.[1] ?? text.trim();
}

function resolveNumericOperand(raw: string, variables: Map<string, VarValue>): number | undefined {
  const token = raw.trim().toLowerCase();
  if (/^-?\d+(?:\.\d+)?$/.test(token)) return Number(token);
  const found = variables.get(token);
  return found?.type === "number" ? found.value : undefined;
}

/** Text a comparison target resolves to: a known variable's value (of either kind, stringified),
 * or, failing that, the raw words themselves. Unlike numbers, plain text never needs to be
 * "defined first": "If the winner is equal to Alex" is valid even without an "Alex" variable. */
function resolveTextOperand(raw: string, variables: Map<string, VarValue>): string {
  const found = variables.get(stripLeadingThe(raw).toLowerCase());
  if (found) return found.type === "number" ? formatNumber(found.value) : found.value;
  return dequote(raw);
}

function evaluateExpression(expr: string, variables: Map<string, VarValue>): number | undefined {
  const match = EXPR_RE.exec(expr.trim());
  if (!match) return undefined;
  const left = resolveNumericOperand(match[1]!, variables);
  if (left === undefined) return undefined;
  if (!match[2]) return left;
  const right = resolveNumericOperand(match[3]!, variables);
  if (right === undefined) return undefined;
  switch (match[2].toLowerCase()) {
    case "plus": return left + right;
    case "minus": return left - right;
    case "times": return left * right;
    case "divided by": return right === 0 ? undefined : left / right;
    default: return undefined;
  }
}

function compareNumbers(value: number, comparator: string, target: number): boolean {
  switch (comparator.toLowerCase()) {
    case "greater than": return value > target;
    case "less than": return value < target;
    case "equal to": return value === target;
    case "not equal to": return value !== target;
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
function closestVariable(name: string, variables: Map<string, VarValue>): string | undefined {
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
  const comparatorPhrase = /^(if\s+the\s+[a-z][a-z ]*?\s+is\s+)([a-z]+\s+[a-z]+(?:\s+[a-z]+)?)(\s+(?:the\s+)?(?:-?\d+(?:\.\d+)?|[a-z][a-z ]*?)\s*,\s*.+)$/i
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
 * "For each X in ..., ..." into plain page-grammar instructions. Each sentence can carry
 * one instruction, or several chained with "and then" (e.g. "..., add a swatch and then
 * set its color."); nesting one of these sentences inside another is not supported yet, so
 * the grammar stays unambiguous while still reading as ordinary English.
 */
export function expandMacros(source: string): MacroExpandResult {
  const lines = source.split(/\r?\n/);
  const variables = new Map<string, VarValue>();
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
      const name = assign[1]!.trim().toLowerCase();
      const rawValue = assign[2]!.trim();
      const numericValue = evaluateExpression(rawValue, variables);
      if (numericValue !== undefined) {
        variables.set(name, { type: "number", value: numericValue });
        return; // a variable sentence does not render anything by itself
      }
      // Only fall back to plain text when the value doesn't even look like an arithmetic
      // attempt (no digits, no "plus"/"minus"/"times"/"divided by"). That keeps a genuine
      // arithmetic mistake, such as dividing by zero, from silently becoming literal text.
      if (!NUMERIC_INTENT_RE.test(rawValue)) {
        const copied = variables.get(stripLeadingThe(rawValue).toLowerCase());
        variables.set(name, copied ?? { type: "text", value: dequote(rawValue) });
        return;
      }
      // Doesn't resolve to a known number or variable expression: leave it for the
      // page compiler to report as an ordinary unrecognized instruction.
      output.push(rawLine);
      return;
    }

    const ifMatch = IF_RE.exec(trimmed);
    if (ifMatch) {
      const name = ifMatch[1]!.trim().toLowerCase();
      const subject = variables.get(name);
      if (subject === undefined) {
        const closest = closestVariable(ifMatch[1]!, variables);
        report(lineNumber, trimmed, "M001", `"${ifMatch[1]!.trim()}" was never given a value.`,
          closest ? `Did you mean "${closest}"?` : `Add a sentence like "The ${ifMatch[1]!.trim()} is 0." before this line.`,
          closest ? [{ label: `Use "${closest}"`, replacement: rawLine.replace(ifMatch[1]!, closest) }] : undefined);
        return;
      }
      const comparator = ifMatch[2]!.trim().toLowerCase();
      if (subject.type === "text") {
        if (comparator !== "equal to" && comparator !== "not equal to") {
          report(lineNumber, trimmed, "M006", `Text can only be compared with "is equal to" or "is not equal to", not "is ${comparator}".`,
            `Try "If the ${ifMatch[1]!.trim()} is equal to ...".`,
            [{ label: `Change "${comparator}" to "equal to"`, replacement: rawLine.replace(ifMatch[2]!, "equal to") }]);
          return;
        }
        const target = resolveTextOperand(ifMatch[3]!, variables);
        const isEqual = subject.value.trim().toLowerCase() === target.trim().toLowerCase();
        lastCondition = comparator === "equal to" ? isEqual : !isEqual;
        if (lastCondition) for (const instr of splitInstructions(ifMatch[4]!)) output.push(instr);
        return;
      }
      const target = resolveNumericOperand(ifMatch[3]!, variables);
      if (target === undefined) {
        const closest = closestVariable(ifMatch[3]!, variables);
        report(lineNumber, trimmed, "M002", `"${ifMatch[3]!.trim()}" is not a number or a known variable.`,
          closest ? `Did you mean "${closest}"?` : `Compare "${ifMatch[1]!.trim()}" to a number or to a variable defined earlier.`,
          closest ? [{ label: `Use "${closest}"`, replacement: rawLine.replace(ifMatch[3]!, closest) }] : undefined);
        return;
      }
      lastCondition = compareNumbers(subject.value, comparator, target);
      if (lastCondition) for (const instr of splitInstructions(ifMatch[4]!)) output.push(instr);
      return;
    }

    const otherwise = OTHERWISE_RE.exec(trimmed);
    if (otherwise) {
      if (lastCondition === undefined) {
        report(lineNumber, trimmed, "M003", `"Otherwise" must come right after an "If" sentence.`,
          `Add an "If the ... is ..., ..." sentence before this line.`);
        return;
      }
      if (!lastCondition) for (const instr of splitInstructions(otherwise[1]!)) output.push(instr);
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
      const instructions = splitInstructions(forEach[3]!);
      for (const item of items) {
        for (const instr of instructions) output.push(substituteWord(instr, loopVar, item));
      }
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
    const found = variables.get(name);
    if (!found) return line;
    return `${trailing[1]}${found.type === "number" ? formatNumber(found.value) : found.value}`;
  });

  return { ok: true, source: finalLines.join("\n") };
}

