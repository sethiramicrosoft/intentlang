// Compile-time only: variables, conditionals, repetition, and reusable procedures, written as
// plain English sentences (no colons, no "end" keywords, no block syntax). Everything here is
// resolved before the page grammar ever sees the source, so THIS layer never generates
// JavaScript -- its output is always plain page-grammar text. (Real runtime interactivity does
// exist in the language, as the page grammar's own "When ... is clicked" sentence in web.ts;
// it isn't part of this compile-time macro layer.)
import { oneEditAway, type VisualDiagnostic, type VisualSuggestion } from "./visual.js";

export type MacroExpandResult =
  | { ok: true; source: string }
  | { ok: false; diagnostics: VisualDiagnostic[] };

/** A variable holds either a number (with arithmetic) or plain text (copied or compared, but
 * not computed). Both kinds are written the same way: "The <name> is <value>." */
type VarValue = { type: "number"; value: number } | { type: "text"; value: string };

/** A reusable procedure: its raw, not-yet-expanded body text, and the names of the zero or more
 * parameters a caller supplies with "with" (several are joined with "and", e.g. "with a and b").
 * Expanded fresh at each call site: it sees every variable that exists at the moment it's
 * called, plus its own parameters bound to whatever the caller passed -- shadowing any outer
 * variable of the same name for the duration of the call, then restoring it, the same way a For
 * each's own loop word only applies while that loop runs. */
type FunctionMap = Map<string, { params: string[]; body: string }>;

const NUMBER_OR_NAME = "(?:the\\s+)?(-?\\d+(?:\\.\\d+)?|[a-z][a-z ]*?)";
const ASSIGN_RE = /^the\s+([a-z][a-z ]*?)\s+is\s+(.+?)\.?$/i;
// A single operand, on its own (used to validate and resolve each link of a chain below).
const OPERAND_RE = new RegExp(`^${NUMBER_OR_NAME}$`, "i");
// Splits "a plus b minus c" into ["a", "plus", "b", "minus", "c"]: operands alternating with
// the operator words that join them. Any number of operators can chain this way -- there's no
// operator precedence, so a chain is always evaluated strictly left to right, the same order
// it reads in English ("a plus b, then minus c").
const CHAIN_SPLIT_RE = /\s+(plus|minus|times|divided by)\s+/i;
const NUMERIC_INTENT_RE = /\d|\b(?:plus|minus|times|divided by)\b/i;
// An If sentence's head, up to its FIRST comma (no matter what follows -- this is what lets an
// If's own instruction be another nested If/For each/Repeat/Do without confusing this boundary).
// The captured text between "if " and that comma is one or more conditions, described below.
const IF_HEAD_RE = /^if\s+(.+?)\s*,\s*(.+?)\.?$/i;
// A single condition, on its own: "the <subject> is <comparator> <target>". The subject can be
// a variable name, or (since a For each counting loop's variable literally substitutes to a
// number) a plain number too, so "if the number is greater than 3" still works after "number"
// is replaced by, say, "4".
const CONDITION_RE = /^the\s+(-?\d+(?:\.\d+)?|[a-z][a-z ]*?)\s+is\s+(greater than|less than|not equal to|equal to|at least|at most)\s+(?:the\s+)?(-?\d+(?:\.\d+)?|[a-z][a-z ]*?)$/i;
// Splits two or more conditions joined by "and" or "or" ("the a is equal to 1 and the b is
// equal to 2"). Only splits right before a literal "the", which is what every condition must
// start with -- so a text comparison's own value can still safely contain the bare word "and"
// or "or" (e.g. "is equal to Alex and Sam") as long as the word right after it isn't "the".
const CONDITION_SPLIT_RE = /\s+(and|or)\s+(?=the\s+)/i;
const OTHERWISE_RE = /^otherwise\s*,\s*(.+?)\.?$/i;
// Only the head ("for each <name> in ") is a fixed shape; where the list ends and the
// instruction begins is worked out by `matchForEachList` below, because a naive "last comma
// on the line" or "first comma on the line" rule each break in different real cases (see
// the comment on `matchForEachList`).
const FOR_EACH_HEAD_RE = /^for each\s+([a-z][a-z ]*?)\s+in\s+(.+)$/i;
// A counting loop's head is a fixed shape with plain numbers on both ends ("from 1 to 10"),
// so unlike a word list, the boundary between the head and the instruction is never ambiguous:
// numbers never contain commas, so the first comma after "to <end>" always separates them.
const FOR_EACH_RANGE_RE = /^for each\s+([a-z][a-z ]*?)\s+from\s+(-?\d+)\s+to\s+(-?\d+)\s*,\s*(.+?)\.?$/i;
// "Repeat <count> times, <instruction>." runs its instruction a fixed number of times with no
// loop variable at all -- simpler than a For each counting loop when nothing needs to vary per
// iteration (e.g. "Repeat 3 times, the total is total plus 1."). Anchored to the end of the
// line/chain-segment the same way If's own instruction is, so it can itself nest another If,
// For each, Repeat, or Do sentence.
const REPEAT_RE = /^repeat\s+(-?\d+)\s+times?\s*,\s*(.+?)\.?$/i;
// A reusable procedure: "To <name>, <body>." defines it (no output by itself); "Do <name>."
// calls it, expanding its body at the call site with whatever variables exist at that moment.
// It can optionally take one or more parameters: "To <name> with <param>, <body>." or
// "To <name> with <param1> and <param2>, <body>." / "Do <name> with <value>." or
// "Do <name> with <value1> and <value2>." -- the word "with" is what marks the parameter list,
// so (like "inside"/"of"/"to" for element names) a procedure name should avoid the word "with"
// to stay unambiguous. Parameter names in a definition are joined with "and" only (never a
// comma), because a comma there would collide with the comma that separates the parameter list
// from the body; a call's argument list may use either style ("with 3 and 4" or "with 3, 4 and
// 5"), since nothing follows it on the line.
// A call's name has no delimiter of its own (unlike If/For each, which stop at a comma), so it
// is anchored to the end of the line/chain-segment the same way Otherwise is.
const FUNCTION_DEF_RE = /^to\s+([a-z][a-z ]*?)(?:\s+with\s+([a-z][a-z ]*?))?\s*,\s*(.+?)\.?$/i;
const FUNCTION_CALL_RE = /^do\s+([a-z][a-z ]*?)(?:\s+with\s+(.+?))?\s*\.?$/i;
const COMPARATORS = ["greater than", "less than", "not equal to", "equal to", "at least", "at most"];
// Multiple instructions in one If/Otherwise/For each sentence are chained with "and then",
// a phrase that reads naturally and never collides with ordinary instruction text (unlike a
// bare "and", which can legitimately appear inside a list or a piece of display text).
const AND_THEN_RE = /\s+and\s+then\s+/i;

function splitInstructions(text: string): string[] {
  return text.split(AND_THEN_RE).map((part) => part.trim()).filter(Boolean);
}

interface ForEachMatch {
  loopVar: string;
  items: string[];
  instruction: string;
}

/**
 * Splits a "For each <name> in <list>, <instruction>" line into its list and instruction.
 * This can't be a single regex with a fixed greedy/non-greedy choice, because either choice
 * breaks a real case:
 *   - A non-greedy list breaks a multi-item list ("red, green and blue"), which needs to keep
 *     its internal commas.
 *   - A greedy list (claim up to the LAST comma) breaks a nested If instruction ("if the a is
 *     equal to 1, set the text ..."), which introduces a comma of its own after the list.
 * Every item list in this language is written as "<item>", "<item> and <item>", or
 * "<item>, <item> and <item>" — in other words, a list with more than one item always contains
 * exactly one " and " connecting its last two items, and that " and " always appears before any
 * instruction text (since the list always comes first). So: split the remainder on every comma,
 * and the list is every segment up to and including the FIRST segment containing " and "; if no
 * segment contains " and ", the list is just the first segment (a single item). Everything after
 * that boundary, rejoined with commas, is the instruction — commas inside a nested If or
 * Otherwise instruction are preserved untouched because they always come after the boundary.
 */
function matchForEachList(trimmed: string): ForEachMatch | undefined {
  const head = FOR_EACH_HEAD_RE.exec(trimmed);
  if (!head) return undefined;
  const loopVar = head[1]!.trim();
  const rest = head[2]!.replace(/\.$/, "");
  const segments = rest.split(",");
  if (segments.length < 2) return undefined; // no comma at all: not a valid For each sentence
  const andIndex = segments.findIndex((segment) => /\band\b/i.test(segment));
  const boundary = andIndex === -1 ? 0 : andIndex;
  if (boundary + 1 >= segments.length) return undefined; // nothing left for the instruction
  const list = segments.slice(0, boundary + 1).join(",").trim();
  const instruction = segments.slice(boundary + 1).join(",").trim().replace(/\.$/, "");
  if (!instruction) return undefined;
  return { loopVar, items: splitEnglishList(list), instruction };
}

/**
 * Matches a "For each <name> from <start> to <end>, <instruction>" counting loop. Unlike a word
 * list, the head here is unambiguous (both ends are plain numbers, which never contain commas),
 * so the instruction is simply everything after the first comma following "to <end>". Counts
 * upward when start <= end, downward otherwise, always inclusive of both ends.
 */
function matchForEachRange(trimmed: string): ForEachMatch | undefined {
  const match = FOR_EACH_RANGE_RE.exec(trimmed);
  if (!match) return undefined;
  const loopVar = match[1]!.trim();
  const start = Number(match[2]);
  const end = Number(match[3]);
  const instruction = match[4]!.trim();
  if (!instruction) return undefined;
  const items: string[] = [];
  if (start <= end) {
    for (let n = start; n <= end; n++) items.push(String(n));
  } else {
    for (let n = start; n >= end; n--) items.push(String(n));
  }
  return { loopVar, items, instruction };
}

/** Matches either shape of a For each sentence: a word list ("in red, green and blue") or a
 * counting loop ("from 1 to 10"). */
function matchForEach(trimmed: string): ForEachMatch | undefined {
  return matchForEachRange(trimmed) ?? matchForEachList(trimmed);
}

type RepeatMatch = { count: number; instruction: string };

/** Matches a "Repeat <count> times, <instruction>" sentence. */
function matchRepeat(trimmed: string): RepeatMatch | undefined {
  const match = REPEAT_RE.exec(trimmed);
  if (!match) return undefined;
  const instruction = match[2]!.trim();
  if (!instruction) return undefined;
  return { count: Number(match[1]), instruction };
}

type IfClause = { subject: string; comparator: string; target: string };
type IfMatch = { clauses: IfClause[]; connectors: string[]; instruction: string };

/**
 * Matches an If sentence's head: one or more conditions, optionally joined with "and" or "or",
 * followed by its instruction after the first comma. Structurally valid even when "and" and
 * "or" are mixed together (e.g. "the a is equal to 1 and the b is equal to 2 or the c is equal
 * to 3") -- that ambiguous case is caught and reported as a clear error at evaluation time (see
 * `evaluateIfCondition`), the same way an empty For each list structurally matches but is
 * reported as an error in `evaluateForEach`, rather than being rejected here.
 */
function matchIf(trimmed: string): IfMatch | undefined {
  const head = IF_HEAD_RE.exec(trimmed);
  if (!head) return undefined;
  const instruction = head[2]!.trim();
  if (!instruction) return undefined;
  const segments = head[1]!.trim().split(CONDITION_SPLIT_RE);
  const clauses: IfClause[] = [];
  const connectors: string[] = [];
  for (let i = 0; i < segments.length; i += 2) {
    const clauseMatch = CONDITION_RE.exec(segments[i]!.trim());
    if (!clauseMatch) return undefined;
    clauses.push({ subject: clauseMatch[1]!.trim(), comparator: clauseMatch[2]!.trim(), target: clauseMatch[3]!.trim() });
    if (i + 1 < segments.length) connectors.push(segments[i + 1]!.trim().toLowerCase());
  }
  return { clauses, connectors, instruction };
}

function splitEnglishList(text: string): string[] {
  const normalized = text.replace(/,?\s+and\s+(?=[^,]+$)/i, ", ");
  return normalized.split(",").map((item) => item.trim()).filter(Boolean);
}

/** Splits a procedure definition's parameter clause ("a", "a and b", "a and b and c") into
 * individual names. Unlike `splitEnglishList`, this never accepts a comma: a comma there would
 * be indistinguishable from the comma that ends the parameter clause and starts the procedure's
 * body, so multiple parameters in a DEFINITION must be joined with "and" only. */
function splitParamNames(text: string): string[] {
  return text.split(/\s+and\s+/i).map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/**
 * Resolves a trailing "... to <variable name>" reference against the CURRENT variables map,
 * right when the instruction is produced. This must happen immediately rather than being
 * deferred to the very end of the file, because a procedure parameter is only bound to the
 * variables map for the duration of its own call: by the time the whole file has been
 * processed, a parameter's temporary binding has already been restored/removed, so resolving
 * it later would see the wrong value (or no value at all).
 */
/**
 * Resolves a trailing "... to <variable name>" or "... to <arithmetic expression>" reference
 * against the CURRENT variables map, right when the instruction is produced. This must happen
 * immediately rather than being deferred to the very end of the file, because a procedure
 * parameter (or a For each loop word) is only bound to the variables map for the duration of
 * its own call/iteration: by the time the whole file has been processed, that binding has
 * already been restored/removed, so resolving it later would see the wrong value (or no value
 * at all). Arithmetic is tried first (e.g. "to a plus b") so a procedure with two or more
 * parameters can combine them directly in a plain instruction, not only inside a "The ... is
 * ..." assignment.
 */
function resolveTrailingVariable(line: string, variables: Map<string, VarValue>): string {
  const trailing = /^(.*\bto\s+)([a-z][a-z ]*)$/i.exec(line.trimEnd());
  if (!trailing) return line;
  const name = trailing[2]!.trim().toLowerCase();
  const numericValue = evaluateExpression(name, variables);
  if (numericValue !== undefined) return `${trailing[1]}${formatNumber(numericValue)}`;
  const found = variables.get(name);
  if (!found) return line;
  return `${trailing[1]}${found.type === "number" ? formatNumber(found.value) : found.value}`;
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
  const parts = expr.trim().split(CHAIN_SPLIT_RE);
  if (parts.length % 2 === 0) return undefined; // an operand must both start and end the chain
  const firstMatch = OPERAND_RE.exec(parts[0]!.trim());
  if (!firstMatch) return undefined;
  let result = resolveNumericOperand(firstMatch[1]!, variables);
  if (result === undefined) return undefined;
  for (let i = 1; i < parts.length; i += 2) {
    const operandMatch = OPERAND_RE.exec(parts[i + 1]!.trim());
    if (!operandMatch) return undefined;
    const right = resolveNumericOperand(operandMatch[1]!, variables);
    if (right === undefined) return undefined;
    switch (parts[i]!.toLowerCase()) {
      case "plus": result = result + right; break;
      case "minus": result = result - right; break;
      case "times": result = result * right; break;
      case "divided by":
        if (right === 0) return undefined;
        result = result / right;
        break;
      default: return undefined;
    }
  }
  return result;
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

/** Closest known procedure name to an unresolved "Do ..." call, for a "did you mean" suggestion. */
function closestFunction(name: string, functions: FunctionMap): string | undefined {
  const key = name.trim().toLowerCase();
  for (const known of functions.keys()) if (oneEditAway(known, key)) return known;
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
      if (matchIf(corrected)) return { label: `Change "${ifWord[1]}" to "if"`, replacement: corrected };
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
      if (matchForEach(corrected)) return { label: `Change "${forWord[1]}" to "for"`, replacement: corrected };
    }
  }
  const inWord = /^(for\s+each\s+[a-z][a-z ]*?\s+)(\S+)(\s+.+)$/i.exec(trimmed);
  if (inWord) {
    const fixed = closestKeyword(inWord[2]!, ["in"]);
    if (fixed) {
      const corrected = `${inWord[1]}in${inWord[3]}`;
      if (matchForEach(corrected)) return { label: `Change "${inWord[2]}" to "in"`, replacement: corrected };
    }
  }
  const repeatWord = /^(\S+)(\s+-?\d+\s+times?\s*,\s*.+)$/i.exec(trimmed);
  if (repeatWord) {
    const fixed = closestKeyword(repeatWord[1]!, ["repeat"]);
    if (fixed) {
      const corrected = `repeat${repeatWord[2]}`;
      if (matchRepeat(corrected)) return { label: `Change "${repeatWord[1]}" to "repeat"`, replacement: corrected };
    }
  }
  const comparatorPhrase = /^(if\s+the\s+[a-z][a-z ]*?\s+is\s+)([a-z]+\s+[a-z]+(?:\s+[a-z]+)?)(\s+(?:the\s+)?(?:-?\d+(?:\.\d+)?|[a-z][a-z ]*?)\s*,\s*.+)$/i
    .exec(trimmed);
  if (comparatorPhrase) {
    const fixed = closestKeyword(comparatorPhrase[2]!, COMPARATORS);
    if (fixed) {
      const corrected = `${comparatorPhrase[1]}${fixed}${comparatorPhrase[3]}`;
      if (matchIf(corrected)) return { label: `Change "${comparatorPhrase[2]}" to "${fixed}"`, replacement: corrected };
    }
  }
  return undefined;
}

function report(diagnostics: VisualDiagnostic[], lineNumber: number, trimmed: string, code: string, message: string,
  hint: string, suggestions?: VisualSuggestion[]) {
  diagnostics.push({
    code, category: suggestions?.length ? "typo" : "syntax", line: lineNumber, column: 1, length: trimmed.length,
    message, hint, ...(suggestions?.length ? { suggestions } : {})
  });
}

/**
 * Evaluates one clause's condition ("the <subject> is <comparator> <target>"). Returns undefined
 * when it couldn't be evaluated (a diagnostic has already been recorded in that case).
 */
function evaluateSingleCondition(clause: IfClause, text: string, lineNumber: number,
  variables: Map<string, VarValue>, diagnostics: VisualDiagnostic[]): boolean | undefined {
  const rawSubject = clause.subject;
  let subject: VarValue;
  if (/^-?\d+(?:\.\d+)?$/.test(rawSubject)) {
    subject = { type: "number", value: Number(rawSubject) };
  } else {
    const name = rawSubject.toLowerCase();
    const found = variables.get(name);
    if (found === undefined) {
      const closest = closestVariable(rawSubject, variables);
      report(diagnostics, lineNumber, text, "M001", `"${rawSubject}" was never given a value.`,
        closest ? `Did you mean "${closest}"?` : `Add a sentence like "The ${rawSubject} is 0." before this line.`,
        closest ? [{ label: `Use "${closest}"`, replacement: text.replace(rawSubject, closest) }] : undefined);
      return undefined;
    }
    subject = found;
  }
  const comparator = clause.comparator.toLowerCase();
  if (subject.type === "text") {
    if (comparator !== "equal to" && comparator !== "not equal to") {
      report(diagnostics, lineNumber, text, "M006",
        `Text can only be compared with "is equal to" or "is not equal to", not "is ${comparator}".`,
        `Try "If the ${rawSubject} is equal to ...".`,
        [{ label: `Change "${comparator}" to "equal to"`, replacement: text.replace(clause.comparator, "equal to") }]);
      return undefined;
    }
    const target = resolveTextOperand(clause.target, variables);
    const isEqual = subject.value.trim().toLowerCase() === target.trim().toLowerCase();
    return comparator === "equal to" ? isEqual : !isEqual;
  }
  const target = resolveNumericOperand(clause.target, variables);
  if (target === undefined) {
    const closest = closestVariable(clause.target, variables);
    report(diagnostics, lineNumber, text, "M002", `"${clause.target}" is not a number or a known variable.`,
      closest ? `Did you mean "${closest}"?` : `Compare "${rawSubject}" to a number or to a variable defined earlier.`,
      closest ? [{ label: `Use "${closest}"`, replacement: text.replace(clause.target, closest) }] : undefined);
    return undefined;
  }
  return compareNumbers(subject.value, comparator, target);
}

/**
 * Evaluates an If sentence's whole condition -- one clause, or several joined with "and" (all
 * must be true) or "or" (at least one must be true) -- but not the surrounding "last condition"
 * state used for Otherwise-pairing, so a nested If never corrupts an outer one's pending
 * Otherwise. Every clause is always evaluated, even once the overall result is already decided
 * (e.g. the first clause of an "or" is already true), so a mistake anywhere in the line is
 * always caught the same way regardless of value order -- consistent with the rest of the
 * language never resolving something silently or inconsistently. Mixing "and" and "or" in the
 * same line is ambiguous (there's no operator precedence in this language, on purpose) and is
 * reported as a clear error rather than guessed at. Returns undefined when the condition itself
 * couldn't be evaluated (a diagnostic has already been recorded in that case).
 */
function evaluateIfCondition(ifMatch: IfMatch, text: string, lineNumber: number,
  variables: Map<string, VarValue>, diagnostics: VisualDiagnostic[]): boolean | undefined {
  const uniqueConnectors = new Set(ifMatch.connectors);
  if (uniqueConnectors.size > 1) {
    report(diagnostics, lineNumber, text, "M015",
      `This If sentence mixes "and" and "or" together, which is ambiguous.`,
      `Use only "and" or only "or" in one If sentence, or split it into two separate If sentences.`);
    return undefined;
  }
  const results: boolean[] = [];
  for (const clause of ifMatch.clauses) {
    const result = evaluateSingleCondition(clause, text, lineNumber, variables, diagnostics);
    if (result === undefined) return undefined;
    results.push(result);
  }
  if (uniqueConnectors.size === 0) return results[0];
  return uniqueConnectors.has("and") ? results.every(Boolean) : results.some(Boolean);
}

/**
 * Expands one For each sentence into its repeated instructions. Each item's instruction is
 * itself expanded with `expandChain`, so it can be a plain instruction, several chained with
 * "and then", or a nested If/Otherwise/For each/Do sentence — see `matchForEach` for how the
 * list and the (possibly nested, possibly comma-containing) instruction are told apart.
 */
function evaluateForEach(forEachMatch: ForEachMatch, lineNumber: number, variables: Map<string, VarValue>,
  diagnostics: VisualDiagnostic[], functions: FunctionMap, callStack: Set<string>): string[] {
  const { loopVar, items, instruction } = forEachMatch;
  if (items.length === 0) {
    report(diagnostics, lineNumber, `for each ${loopVar}`, "M004",
      `"For each ${loopVar} in ..." needs at least one item in its list.`,
      `List one or more items, such as "For each ${loopVar} in red, green and blue, ...".`);
    return [];
  }
  const results: string[] = [];
  for (const item of items) {
    results.push(...expandChain(substituteWord(instruction, loopVar, item), lineNumber, variables, diagnostics, functions, callStack));
  }
  return results;
}

/**
 * Expands one "Repeat <count> times, <instruction>" sentence: runs its instruction that many
 * times in a row, with no loop variable of its own (unlike For each). A negative count is
 * reported as a clear error rather than silently running zero times, since it almost certainly
 * indicates a mistake (e.g. a variable holding a negative number by accident); a count of zero
 * is allowed and simply produces no output.
 */
function evaluateRepeat(repeatMatch: RepeatMatch, lineNumber: number, variables: Map<string, VarValue>,
  diagnostics: VisualDiagnostic[], functions: FunctionMap, callStack: Set<string>): string[] {
  const { count, instruction } = repeatMatch;
  if (count < 0) {
    report(diagnostics, lineNumber, `repeat ${count} times`, "M014",
      `"Repeat ${count} times" needs a count of 0 or more.`,
      `Use a non-negative number, such as "Repeat 3 times, ...".`);
    return [];
  }
  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    results.push(...expandChain(instruction, lineNumber, variables, diagnostics, functions, callStack));
  }
  return results;
}

/**
 * Expands a "Do <name>." or "Do <name> with <value>." call: looks up the procedure's raw body
 * (defined by a "To <name>, ..." or "To <name> with <param>, ..." sentence, anywhere in the
 * file) and expands it at the call site. If the procedure takes one or more parameters, each
 * argument's value is bound to its matching parameter name for the duration of the call,
 * temporarily shadowing any outer variable of the same name and restoring it afterward -- the
 * same lexical-scoping idea a For each's own loop word already uses. `callStack` carries every
 * procedure name currently being expanded on this call path, so a procedure that calls itself
 * (directly, or through another procedure) is caught as a clear error instead of hanging the
 * compiler in recursion.
 */
function resolveArgValue(rawValue: string, variables: Map<string, VarValue>): VarValue {
  const trimmed = rawValue.trim();
  const numericValue = evaluateExpression(trimmed, variables);
  if (numericValue !== undefined) return { type: "number", value: numericValue };
  return variables.get(stripLeadingThe(trimmed).toLowerCase()) ?? { type: "text", value: dequote(trimmed) };
}

function expandFunctionCall(name: string, argRaw: string | undefined, callText: string, lineNumber: number,
  variables: Map<string, VarValue>, diagnostics: VisualDiagnostic[], functions: FunctionMap,
  callStack: Set<string>): string[] {
  const fn = functions.get(name);
  if (fn === undefined) {
    const closest = closestFunction(name, functions);
    report(diagnostics, lineNumber, callText, "M007", `"${name}" was never defined.`,
      closest ? `Did you mean "Do ${closest}."?` : `Add a sentence like "To ${name}, ..." before this line.`,
      closest ? [{ label: `Use "${closest}"`, replacement: callText.replace(name, closest) }] : undefined);
    return [];
  }
  if (callStack.has(name)) {
    report(diagnostics, lineNumber, callText, "M008",
      `"${name}" calls itself, directly or indirectly, which isn't supported yet.`,
      `Rewrite "${name}" so it doesn't call itself.`);
    return [];
  }
  if (fn.params.length > 0 && argRaw === undefined) {
    report(diagnostics, lineNumber, callText, "M010", `"${name}" needs ${fn.params.length === 1 ? "a value" : `${fn.params.length} values`}.`,
      `Try "Do ${name} with ${fn.params.map((_, i) => `<value${fn.params.length > 1 ? ` ${i + 1}` : ""}>`).join(" and ")}".`);
    return [];
  }
  if (fn.params.length === 0 && argRaw !== undefined) {
    report(diagnostics, lineNumber, callText, "M011", `"${name}" doesn't take a value.`,
      `Try "Do ${name}."`);
    return [];
  }
  // A single-parameter call's whole argument is taken as one literal value (so text containing
  // the word "and", such as "Do greet with Alex and Sam.", still works as one value). Only a
  // procedure that takes two or more parameters splits its argument text on "and"/commas, the
  // same way a For each's own list does.
  const values = fn.params.length === 0 ? [] : fn.params.length === 1 ? [argRaw!.trim()] : splitEnglishList(argRaw!);
  if (values.length !== fn.params.length) {
    report(diagnostics, lineNumber, callText, "M012",
      `"${name}" needs ${fn.params.length} values, but this call gives ${values.length}.`,
      `Try "Do ${name} with ${fn.params.map((_, i) => `<value ${i + 1}>`).join(" and ")}".`);
    return [];
  }
  const restore: { name: string; hadPrevious: boolean; previous: VarValue | undefined }[] = [];
  for (let i = 0; i < fn.params.length; i++) {
    const paramName = fn.params[i]!;
    restore.push({ name: paramName, hadPrevious: variables.has(paramName), previous: variables.get(paramName) });
    variables.set(paramName, resolveArgValue(values[i]!, variables));
  }
  const nextCallStack = new Set(callStack);
  nextCallStack.add(name);
  const result = expandChain(fn.body, lineNumber, variables, diagnostics, functions, nextCallStack);
  for (const entry of restore) {
    if (entry.hadPrevious) variables.set(entry.name, entry.previous!); else variables.delete(entry.name);
  }
  return result;
}

/**
 * Applies a "The X is Y." assignment: resolves Y as a number expression first, falling back to
 * copying an existing variable's value, and finally to literal text (only when Y doesn't even
 * look like an arithmetic attempt, so a genuine mistake like dividing by zero isn't silently
 * treated as text). Returns true once handled; false means the caller should leave the line for
 * the page compiler to report as an ordinary unrecognized instruction.
 */
function applyAssignment(name: string, rawValue: string, variables: Map<string, VarValue>): boolean {
  const numericValue = evaluateExpression(rawValue, variables);
  if (numericValue !== undefined) {
    variables.set(name, { type: "number", value: numericValue });
    return true;
  }
  if (!NUMERIC_INTENT_RE.test(rawValue)) {
    const copied = variables.get(stripLeadingThe(rawValue).toLowerCase());
    variables.set(name, copied ?? { type: "text", value: dequote(rawValue) });
    return true;
  }
  return false;
}

/**
 * Expands one instruction, recognizing that the instruction can itself be a whole nested If,
 * For each, or Do sentence, e.g. "If the score is at least 40, if the wins is at least 10, set
 * the text of message to double win." Nesting works for If because its own parsing always stops
 * at the FIRST comma after its comparison target, no matter what follows. Nesting works for For
 * each too because `matchForEach` locates the list/instruction boundary by finding the list's
 * own " and ", not by guessing from comma position, so a nested clause's commas never confuse it.
 */
function expandInstruction(instr: string, lineNumber: number, variables: Map<string, VarValue>,
  diagnostics: VisualDiagnostic[], functions: FunctionMap, callStack: Set<string>): string[] {
  const trimmedInstr = instr.trim();
  const assign = ASSIGN_RE.exec(trimmedInstr);
  if (assign && applyAssignment(assign[1]!.trim().toLowerCase(), assign[2]!.trim(), variables)) return [];
  const nestedIf = matchIf(trimmedInstr);
  if (nestedIf) {
    const condition = evaluateIfCondition(nestedIf, trimmedInstr, lineNumber, variables, diagnostics);
    if (condition === undefined) return [];
    return condition ? expandChain(nestedIf.instruction, lineNumber, variables, diagnostics, functions, callStack) : [];
  }
  const nestedForEach = matchForEach(trimmedInstr);
  if (nestedForEach) return evaluateForEach(nestedForEach, lineNumber, variables, diagnostics, functions, callStack);
  const nestedRepeat = matchRepeat(trimmedInstr);
  if (nestedRepeat) return evaluateRepeat(nestedRepeat, lineNumber, variables, diagnostics, functions, callStack);
  const call = FUNCTION_CALL_RE.exec(trimmedInstr);
  if (call) return expandFunctionCall(call[1]!.trim().toLowerCase(), call[2], trimmedInstr, lineNumber, variables, diagnostics, functions, callStack);
  return [resolveTrailingVariable(instr, variables)];
}

/**
 * Splits an If or Otherwise sentence's body on "and then", expanding each part (which may
 * itself be a nested If, For each, or Do sentence) in order. A nested If's body and a nested For
 * each's instruction always extend to the end of whatever string they're given (that's how each
 * one's own regex is anchored), so once a chain part starts a nested If or For each, everything
 * from there to the end of the chain belongs to that nested construct -- it must be rejoined and
 * handled as one unit rather than being cut apart by this function's own "and then" split. A Do
 * call has no such body of its own (its name is the whole remaining text), so it needs no
 * rejoining: `splitInstructions` already isolates it as one ordinary part.
 */
function expandChain(text: string, lineNumber: number, variables: Map<string, VarValue>,
  diagnostics: VisualDiagnostic[], functions: FunctionMap, callStack: Set<string>): string[] {
  const parts = splitInstructions(text);
  const result: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const rest = parts.slice(i).join(" and then ").trim();
    if (matchIf(rest) || matchForEach(rest) || matchRepeat(rest)) {
      result.push(...expandInstruction(rest, lineNumber, variables, diagnostics, functions, callStack));
      return result; // the nested construct consumed everything remaining in the chain
    }
    result.push(...expandInstruction(parts[i]!, lineNumber, variables, diagnostics, functions, callStack));
  }
  return result;
}

/** True if any line looks like a variable, conditional, repetition, or procedure sentence. */
export function usesMacroGrammar(source: string): boolean {
  return source.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    return ASSIGN_RE.test(trimmed) || matchIf(trimmed) !== undefined || OTHERWISE_RE.test(trimmed) || matchForEach(trimmed) !== undefined
      || matchRepeat(trimmed) !== undefined || FUNCTION_DEF_RE.test(trimmed) || FUNCTION_CALL_RE.test(trimmed);
  });
}

/**
 * Expands "The X is Y.", "If the X is ..., ...", "Otherwise, ...", "For each X in ..., ...",
 * "To <name>, ..." and "Do <name>." into plain page-grammar instructions. Each sentence can
 * carry one instruction, several chained with "and then", or a nested If/Otherwise/For each/Do
 * sentence, nested as deep as you like. Procedures ("To .../Do ...") can be called from anywhere
 * in the file, including before the line that defines them -- like any real function -- because
 * every definition is collected in a first pass before the file's instructions are expanded.
 */
export function expandMacros(source: string): MacroExpandResult {
  const lines = source.split(/\r?\n/);
  const variables = new Map<string, VarValue>();
  const functions: FunctionMap = new Map();
  const output: string[] = [];
  const diagnostics: VisualDiagnostic[] = [];
  let lastCondition: boolean | undefined;

  // First pass: collect every "To <name>, <body>." (or "To <name> with <param>, <body>.")
  // procedure definition, wherever it appears in the file, so a call further up the file can
  // still find it.
  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    const def = FUNCTION_DEF_RE.exec(trimmed);
    if (!def) return;
    const name = def[1]!.trim().toLowerCase();
    if (functions.has(name)) {
      report(diagnostics, index + 1, trimmed, "M009", `"${name}" was already defined.`,
        `Give this procedure a different name, or remove the earlier "To ${name}, ..." sentence.`);
      return;
    }
    const params = def[2] ? splitParamNames(def[2]) : [];
    const duplicate = params.find((param, i) => params.indexOf(param) !== i);
    if (duplicate) {
      report(diagnostics, index + 1, trimmed, "M013", `"${name}" uses the parameter name "${duplicate}" more than once.`,
        `Give each parameter a different name.`);
      return;
    }
    functions.set(name, { params, body: def[3]!.trim() });
  });
  if (diagnostics.length > 0) return { ok: false, diagnostics };

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const trimmed = rawLine.trim();
    if (!trimmed) { output.push(rawLine); return; }

    if (FUNCTION_DEF_RE.test(trimmed)) return; // already collected above; defines, renders nothing

    const assign = ASSIGN_RE.exec(trimmed);
    if (assign) {
      const name = assign[1]!.trim().toLowerCase();
      const rawValue = assign[2]!.trim();
      if (applyAssignment(name, rawValue, variables)) return; // a variable sentence does not render anything by itself
      // Doesn't resolve to a known number or variable expression: leave it for the
      // page compiler to report as an ordinary unrecognized instruction.
      output.push(resolveTrailingVariable(rawLine, variables));
      return;
    }

    const ifMatch = matchIf(trimmed);
    if (ifMatch) {
      const condition = evaluateIfCondition(ifMatch, trimmed, lineNumber, variables, diagnostics);
      if (condition === undefined) return; // a diagnostic was already recorded
      lastCondition = condition;
      if (condition) for (const instr of expandChain(ifMatch.instruction, lineNumber, variables, diagnostics, functions, new Set())) output.push(instr);
      return;
    }

    const otherwise = OTHERWISE_RE.exec(trimmed);
    if (otherwise) {
      if (lastCondition === undefined) {
        report(diagnostics, lineNumber, trimmed, "M003", `"Otherwise" must come right after an "If" sentence.`,
          `Add an "If the ... is ..., ..." sentence before this line.`);
        return;
      }
      if (!lastCondition) for (const instr of expandChain(otherwise[1]!, lineNumber, variables, diagnostics, functions, new Set())) output.push(instr);
      return;
    }

    const forEach = matchForEach(trimmed);
    if (forEach) {
      for (const instr of evaluateForEach(forEach, lineNumber, variables, diagnostics, functions, new Set())) output.push(instr);
      return;
    }

    const repeat = matchRepeat(trimmed);
    if (repeat) {
      for (const instr of evaluateRepeat(repeat, lineNumber, variables, diagnostics, functions, new Set())) output.push(instr);
      return;
    }

    const call = FUNCTION_CALL_RE.exec(trimmed);
    if (call) {
      for (const instr of expandFunctionCall(call[1]!.trim().toLowerCase(), call[2], trimmed, lineNumber, variables, diagnostics, functions, new Set())) {
        output.push(instr);
      }
      return;
    }

    const fix = suggestMacroFix(trimmed);
    if (fix) {
      report(diagnostics, lineNumber, trimmed, "M005",
        `This line looks like it was meant to be a variable, If, Otherwise, For each, Repeat, To, or Do sentence, but has a spelling mistake.`,
        fix.label, [fix]);
      return;
    }

    output.push(resolveTrailingVariable(rawLine, variables));
  });

  if (diagnostics.length > 0) return { ok: false, diagnostics };

  return { ok: true, source: output.join("\n") };
}

