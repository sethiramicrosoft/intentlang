import { createHash } from "node:crypto";
import { generate, lexer, parse, tokenize, tokenTypes, walk } from "css-tree";
import { parseFragment, type DefaultTreeAdapterTypes } from "parse5";
import {
  colors, compileVisualSource, escapeHtml, oneEditAway, sizes, slants, underlines, weights,
  type VisualDiagnostic, type VisualSuggestion
} from "./visual.js";
import { parseVisualStatement } from "./visual-syntax.js";
import {
  attributesFor, englishName, inputPresets, requiredParents, webElements, webStyles,
  type AttributeCapability, type ElementCapability, type WebCapability
} from "./web-catalogue.js";
import { parsePageStatement } from "./web-syntax.js";

export interface PageElement {
  name: string;
  id: string;
  tag: string;
  parent: string;
  text: string;
  attributes: Record<string, string>;
  styles: Record<string, string>;
  line: number;
}
export interface PageProgram {
  kind: "page";
  elements: PageElement[];
}
export type PageCompileResult =
  | { ok: true; ir: PageProgram; html: string }
  | { ok: false; diagnostics: VisualDiagnostic[] };

const referenceAttributes = new Set([
  "for", "list", "form", "popovertarget", "headers", "itemref",
  "aria-labelledby", "aria-describedby", "aria-controls", "aria-owns",
  "aria-activedescendant", "aria-details", "aria-errormessage", "aria-flowto"
]);
const urlAttributes = new Set(["href", "src", "poster", "cite", "itemid"]);
const textForbidden = new Set(["ul", "ol", "menu", "dl", "table", "thead", "tbody", "tfoot", "tr", "colgroup", "select", "optgroup", "picture"]);
const allowedChildren: Readonly<Record<string, string[]>> = {
  ul: ["li"], ol: ["li"], menu: ["li"], dl: ["dt", "dd", "div"],
  table: ["caption", "colgroup", "thead", "tbody", "tfoot", "tr"],
  thead: ["tr"], tbody: ["tr"], tfoot: ["tr"], tr: ["td", "th"], colgroup: ["col"],
  select: ["option", "optgroup", "hr"], optgroup: ["option"], picture: ["source", "img"]
};
const textOnly = new Set(["textarea", "option"]);
const normalKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const targetKey = (value: string) => normalKey(value).replace(/^the\s+/, "");

function validUrl(value: string, image = false): boolean {
  if (/[\s\\\u0000-\u001f\u007f]/.test(value) || value.startsWith("//")) return false;
  if (/^data:/i.test(value)) return image && /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(value);
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) {
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  }
  return value.length > 0;
}

function cssValue(property: string, value: string): { value: string } | { error: string } {
  let normalized = value.trim();
  if (/^(?:background-image|list-style-image)$/.test(property) && /^https:/i.test(normalized)) {
    normalized = `url(${JSON.stringify(normalized)})`;
  } else if (property !== "font-family" && property !== "content") {
    const protectedRanges: { start: number; end: number }[] = [];
    tokenize(normalized, (type, start, end) => {
      if (type === tokenTypes.String || type === tokenTypes.Url) protectedRanges.push({ start, end });
    });
    const convert = (part: string) => part
      .replace(/(-?\d+(?:\.\d+)?)\s*(pixels?|percent|root ems?|ems?|seconds?|milliseconds?|degrees?)\b/gi, (_, number: string, rawUnit: string) => {
        const unit = rawUnit.toLowerCase();
        const suffix = unit.startsWith("pixel") ? "px" : unit === "percent" ? "%" :
          unit.startsWith("root") ? "rem" : unit.startsWith("em") ? "em" :
          unit.startsWith("millisecond") ? "ms" : unit.startsWith("second") ? "s" : "deg";
        return number + suffix;
      })
      .replace(/\b(light blue|light gray|light grey|dark blue|dark gray|dark grey)\b/g, (color) => color.replace(" ", ""))
      .replace(/\b(space between|space around|space evenly|inline block|inline flex|inline grid|row reverse|column reverse|border box|content box)\b/g,
        (keyword) => keyword.replace(" ", "-"))
      .replace(/\bno wrap\b/g, "nowrap");
    let converted = "";
    let cursor = 0;
    for (const range of protectedRanges) {
      converted += convert(normalized.slice(cursor, range.start)) + normalized.slice(range.start, range.end);
      cursor = range.end;
    }
    normalized = converted + convert(normalized.slice(cursor));
  }
  try {
    const ast = parse(normalized, { context: "value" });
    let unsafeUrl = false;
    walk(ast, (node) => {
      if (node.type === "Url" && !validUrl(node.value, true)) unsafeUrl = true;
    });
    if (unsafeUrl) return { error: "Use an HTTPS or relative resource URL, not an executable URL." };
    const matched = lexer.matchProperty(property, ast);
    if (!matched.matched) return { error: `Invalid value for ${englishName(property)}. ${matched.error?.message.split("\n")[0] ?? "Use the property's supported value syntax."}` };
    return { value: generate(ast).replaceAll("<", "\\3c ") };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return { error: `Invalid style value: ${error.message}` };
  }
}

export function compilePageSource(source: string): PageCompileResult {
  const diagnostics: VisualDiagnostic[] = [];
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const root: PageElement = { name: "page", id: "page", tag: "body", parent: "", text: "", attributes: {}, styles: {}, line: 1 };
  const elements = [root];
  const names = new Map<string, PageElement>([["page", root]]);
  const claims = new Set<string>();
  const references: { node: PageElement; attribute: string; value: string; line: number }[] = [];
  // Each entry is one already-safe JS statement (element ids are compiler-generated,
  // never derived from user text; literal text is always embedded via JSON.stringify).
  const runtimeScripts: string[] = [];
  // Statements from "When the page loads, ..." -- run once, immediately, in source order,
  // ahead of any click-handler registration below (so a page-load default doesn't
  // accidentally overwrite state a click has already set, which can't happen at parse
  // time anyway, but keeps the generated script's own ordering intuitive to read).
  const onloadScripts: string[] = [];
  // Set to true the moment a "fetch the text at ..." action successfully compiles -- lets the
  // CSP stay at its strictest "default-src 'none'" (blocking all network access) for every
  // ordinary page, and only ever loosen to "connect-src 'self'" (same-origin requests only,
  // never a third-party or cross-origin URL) for the specific pages that actually opt into
  // talking to a backend. This is a narrower grant than default-src's own blanket "none": it
  // still blocks images/media/fonts/scripts from anywhere but the existing allowances, and
  // even same-origin fetches are restricted to whatever the compiler itself validated as a
  // same-origin relative path (see fetchText's own path check below).
  let usesFetch = false;
  function report(index: number, message: string, hint: string, suggestions?: VisualSuggestion[], category: VisualDiagnostic["category"] = "syntax") {
    const line = lines[index] ?? "";
    diagnostics.push({ code: category === "ambiguity" ? "W002" : "W001", category, message, hint,
      line: index + 1, column: Math.max(1, line.search(/\S/) + 1), length: Math.max(1, line.trim().length),
      ...(suggestions?.length ? { suggestions } : {}) });
  }
  function claim(node: PageElement, property: string, index: number): boolean {
    const key = `${node.id}:${property}`;
    if (claims.has(key)) {
      report(index, `More than one instruction sets ${property} of ${node.name}.`, "Edit the existing instruction instead of adding a conflicting one.");
      return false;
    }
    claims.add(key);
    return true;
  }
  function resolve(reference: string, index: number): PageElement | undefined {
    const key = targetKey(reference);
    if (key === "it") {
      const candidates = elements.slice(1);
      if (candidates.length === 1) return candidates[0];
      report(index, candidates.length ? '"It" could refer to more than one element.' : '"It" has no earlier element.',
        "Choose an element by name.",
        candidates.slice(0, 6).map((node) => ({ label: `Use ${node.name}`, replacement: lines[index]!.replace(/\bit\b/i, node.name) })),
        "ambiguity");
      return undefined;
    }
    const found = names.get(key);
    if (!found) {
      const matches = elements.filter((node) => oneEditAway(key, node.name)).slice(0, 6);
      report(index, `There is no earlier element called ${reference}.`, "Add that element first, or use an existing name.",
        matches.map((node) => ({ label: `Use ${node.name}`, replacement: lines[index]!.replace(reference, node.name) })),
        matches.length ? "typo" : "syntax");
    }
    return found;
  }
  /**
   * Compiles a "When ... is clicked, <body>" sentence's body into a single JS statement string,
   * or undefined if a diagnostic was reported. Only a small, closed set of runtime instructions
   * is supported (chained the same way macro instructions chain, with "and then"), so the
   * generated code is always one of a handful of fixed shapes: it never runs user-supplied text
   * as code, only ever embeds it as a JSON-encoded string or a validated plain number.
   */
  function compileClickBody(body: string, index: number): string | undefined {
    const parts = body.split(/\s+and\s+then\s+/i).map((part) => part.trim()).filter(Boolean);
    const statements: string[] = [];
    for (const part of parts) {
      const compiled = compileClickPart(part, index);
      if (compiled === undefined) return undefined;
      statements.push(compiled);
    }
    return statements.join("");
  }
  // Maps a plain-English comparison word to its JS operator; only these six are recognized,
  // so a runtime "if" can never compile to an arbitrary/unsafe comparison. "not equal to" is
  // checked before "equal to" in the ifValue alternation below so "is not equal to" isn't cut
  // short by "equal to" alone leaving a leftover "not" unmatched.
  const clickComparisons: Record<string, string> = {
    "greater than": ">", "less than": "<", "at least": ">=", "at most": "<=", "equal to": "===",
    "not equal to": "!=="
  };
  // Same idea for text comparisons; only these five verbs are recognized. Ordered with
  // "is not" before "is" in the regex alternation below so "is not" isn't cut short.
  const textComparisons: Record<string, (left: string, right: string) => string> = {
    "is": (left, right) => `${left}===${right}`,
    "is not": (left, right) => `${left}!==${right}`,
    "contains": (left, right) => `${left}.includes(${right})`,
    "starts with": (left, right) => `${left}.startsWith(${right})`,
    "ends with": (left, right) => `${left}.endsWith(${right})`
  };
  // Maps a plain-English length comparison word to its JS operator; distinct from
  // clickComparisons' vocabulary ("more than"/"fewer than"/"exactly" instead of "greater
  // than"/"less than"/"equal to"), since "how many characters" reads more naturally that way.
  const lengthComparisons: Record<string, string> = {
    "more than": ">", "fewer than": "<", "at least": ">=", "at most": "<=", "exactly": "==="
  };
  /**
   * Compiles a single click instruction (one "and then"-separated part, or the inner
   * instruction of an "If ..., ..." conditional) into one JS statement, or undefined if a
   * diagnostic was already reported. Recursive so "If ..." can wrap any other instruction.
   */
  function compileClickPart(part: string, index: number): string | undefined {
    // Checked first: its own trailing instruction is compiled recursively, so it must not be
    // shadowed by any of the plainer patterns below matching a prefix of the same text.
    // Group 5 (the optional "otherwise" clause) is greedy, so a lone " otherwise " literal
    // inside the "then" instruction's own text would be misread as the else-branch split;
    // documented as a reserved word in this position, matching how "otherwise" is already
    // reserved after "If" everywhere else in the language. The right-hand side of the
    // comparison (group 3 or group 4) is either a literal number or another live input's
    // value, checked as alternatives in the same capture position.
    const ifValue = /^if\s+the\s+value\s+of\s+(.+?)\s+is\s+(greater than|less than|at least|at most|not equal to|equal to)\s+(?:the\s+value\s+of\s+(.+?)|(-?\d+(?:\.\d+)?))\s*,\s*(.+?)(?:\s+otherwise\s+(.+))?$/i.exec(part);
    // An inclusive range check on both ends. Either end can be a plain number known at
    // compile time, or (like ifValue's right-hand side) another live input's own value --
    // in which case the range can move with whatever a visitor actually typed, so the
    // backwards-range compile-time check below only applies when both ends are still plain
    // numbers. Checked before ifText below so "is between 1 and 10" is never misread as a
    // literal-text comparison against the whole phrase "between 1 and 10".
    const ifBetween = !ifValue ?
      /^if\s+the\s+value\s+of\s+(.+?)\s+is\s+between\s+(?:the\s+value\s+of\s+(.+?)|(-?\d+(?:\.\d+)?))\s+and\s+(?:the\s+value\s+of\s+(.+?)|(-?\d+(?:\.\d+)?))\s*,\s*(.+?)(?:\s+otherwise\s+(.+))?$/i.exec(part) : null;
    // A live text's own length, for validation like a minimum/maximum password or username
    // length -- distinct from the value comparisons above, which compare the text/number
    // itself, not how long it is. Checked before ifText below for the same shadowing reason
    // as ifBetween: "has more than 5 characters" must never be misread as literal text. The
    // bound can be a plain number of characters, or (naturally phrased to avoid a clunky
    // "characters ... characters" repetition) "as many characters as the value of <input>",
    // for comparing one field's length against another's live length -- e.g. confirming a
    // "confirm password" field is exactly as long as "password" before even checking equality.
    const ifLength = !ifValue && !ifBetween ?
      /^if\s+the\s+value\s+of\s+(.+?)\s+has\s+(more than|fewer than|at least|at most|exactly)\s+(?:as\s+many\s+characters\s+as\s+the\s+value\s+of\s+(.+?)|(\d+)\s+characters?)\s*,\s*(.+?)(?:\s+otherwise\s+(.+))?$/i.exec(part) : null;
    // Only tried when the numeric form above doesn't match (e.g. "is red" rather than
    // "is greater than 5"), so a numeric comparison is never misread as a text one. "is not"
    // must come before the plain "is" in the alternation, or "is not red" would match "is"
    // with a leftover "not red" as the compared text instead of matching "is not" whole.
    const ifText = !ifValue && !ifBetween && !ifLength ? /^if\s+the\s+value\s+of\s+(.+?)\s+(is not|is|contains|starts with|ends with)\s+(?:the\s+value\s+of\s+(.+?)|(.+?))\s*,\s*(.+?)(?:\s+otherwise\s+(.+))?$/i.exec(part) : null;
    // The read-side condition sibling of "set the value of ... to the option labeled ..." /
    // "set the text of ... to the selected label of ...": compares a dropdown's selected
    // option's own displayed text directly, rather than its (possibly divergent) ".value" --
    // distinct from ifText, which only ever compares raw ".value". Its own literal ("the
    // selected label of ...") never overlaps with ifText's ("the value of ..."), so there's
    // no shadowing risk either way, but it's placed alongside the other If forms for clarity.
    // The right-hand side can be a plain word/phrase, or (like ifText's own right-hand side)
    // another dropdown's own selected label, for comparing what two dropdowns actually show
    // a visitor, regardless of either one's underlying value attribute.
    const ifLabel = /^if\s+the\s+selected\s+label\s+of\s+(.+?)\s+(is not|is)\s+(?:the\s+selected\s+label\s+of\s+(.+?)|(.+?))\s*,\s*(.+?)(?:\s+otherwise\s+(.+))?$/i.exec(part);
    // A checkbox/radio button's state lives in ".checked", not ".value" (its ".value" is a
    // fixed attribute, never reflecting whether it's ticked) -- this is a separate condition
    // form for that reason. The negative lookahead keeps it from ever matching "if the value
    // of X is checked, ..." (which isn't valid there, since "checked" isn't a recognized
    // ifValue/ifText comparison word either, and would otherwise misread "the value of X"
    // itself as the checkbox's name).
    // Checked before the plain "is checked"/"is not checked" form below: that one requires a
    // comma immediately after the word "checked", so "is checked the same as ..." never
    // actually matches it (there's a " the same as ..." in between), but this is placed first
    // anyway for the same clarity reason every other live-vs-fixed pair in this function is.
    const ifCheckedMatch = /^if\s+(?!the\s+value\s+of\s)(.+?)\s+is\s+(not\s+)?checked\s+the\s+same\s+as\s+(.+?)\s*,\s*(.+?)(?:\s+otherwise\s+(.+))?$/i.exec(part);
    const ifChecked = !ifCheckedMatch && !ifValue && !ifBetween && !ifLength && !ifText && !ifLabel ?
      /^if\s+(?!the\s+value\s+of\s)(.+?)\s+is\s+(checked|not checked)\s*,\s*(.+?)(?:\s+otherwise\s+(.+))?$/i.exec(part) : null;
    // The missing condition-side counterpart to "disable"/"enable": reads a form control's
    // own live ".disabled" property, the same native browser flag those two actions already
    // set. Useful for a click that only acts once some other control has actually become
    // disabled/enabled first (e.g. a submit button that only fires once a prerequisite field
    // it previously disabled is re-enabled again). No shadowing precaution is needed against
    // ifChecked/ifValue/etc.: none of their own comparison words are "disabled"/"not disabled",
    // so this can never be misread as (or misread) any of those forms.
    const ifDisabled = /^if\s+(?!the\s+value\s+of\s)(.+?)\s+is\s+(disabled|not disabled)\s*,\s*(.+?)(?:\s+otherwise\s+(.+))?$/i.exec(part);
    // "Repeat" needs no shadowing precaution of its own -- no other pattern starts with the
    // word "repeat" -- but like "if", its own trailing instruction is compiled recursively.
    // The count can be a plain number known at compile time, or (matching how every other
    // "the value of ..." reference in this family works) a live input's own value, for a
    // loop count a visitor actually typed rather than one fixed at compile time.
    const repeat = /^repeat\s+(?:the\s+value\s+of\s+(.+?)|(-?\d+))\s+times?\s*,\s*(.+)$/i.exec(part);
    // Checked before the plainer "set the text of X to Y", since that one's own value half
    // would otherwise happily swallow "the value of Y" as literal display text instead.
    // Guarded against setRandom below: "set the text of roll to a random number from the
    // value of low bound to the value of high bound" also contains a literal " to the value
    // of " substring (inside its own "from ... to ..." clause), which the non-greedy (.+?)
    // here would otherwise happily swallow as setFromValue's own target name instead of
    // letting setRandom's more specific pattern match the whole instruction.
    const setRandomPreCheck = /^set\s+the\s+text\s+of\s+(?:.+?)\s+to\s+a\s+random\s+number\s+from\s+/i.test(part);
    const setFromValue = !setRandomPreCheck ? /^set\s+the\s+text\s+of\s+(.+?)\s+to\s+the\s+value\s+of\s+(.+)$/i.exec(part) : null;
    // A dropdown's own ".value" is its selected option's value attribute (or, if that option
    // has none, its own displayed text -- the HTML default) -- but once an option's value is
    // set explicitly to something other than its label (e.g. a short code), ".value" no
    // longer matches what the visitor actually saw and picked. This reads the selected
    // option's own displayed text instead, regardless of its value attribute. Checked before
    // setText for the same shadowing reason as setFromValue/setRandom.
    const setFromLabel = /^set\s+the\s+text\s+of\s+(.+?)\s+to\s+the\s+selected\s+label\s+of\s+(.+)$/i.exec(part);
    // A live character counter -- how many characters a visitor has actually typed so far --
    // read directly from a live input's own value, without needing the compile-time-only
    // "the number of items in <list>" length helper (which only measures a fixed list
    // variable, never a live input). Checked before setText for the same shadowing reason as
    // setFromValue/setFromLabel/setRandom.
    const setFromLength = /^set\s+the\s+text\s+of\s+(.+?)\s+to\s+the\s+number\s+of\s+characters\s+in\s+the\s+value\s+of\s+(.+)$/i.exec(part);
    // Same reason: checked before the plainer "set the text of X to Y", so its own value
    // half doesn't swallow "a random number from A to B" as literal display text instead.
    // Either end can be a plain number known at compile time, or (like ifBetween's own ends)
    // another live input's own value, so a random range can move with whatever a visitor
    // actually typed rather than only ever being fixed.
    const setRandom = /^set\s+the\s+text\s+of\s+(.+?)\s+to\s+a\s+random\s+number\s+from\s+(?:the\s+value\s+of\s+(.+?)|(-?\d+))\s+to\s+(?:the\s+value\s+of\s+(.+?)|(-?\d+))$/i.exec(part);
    const setText = /^set\s+the\s+text\s+of\s+(.+?)\s+to\s+(.+)$/i.exec(part);
    // Checked before the plain "add/subtract <number>" forms below, for the same reason
    // setFromValue is checked before setText: otherwise "the value of X" would be read as a
    // (non-numeric) literal amount instead of a live input value.
    const addFromValue = /^add\s+the\s+value\s+of\s+(.+?)\s+to\s+the\s+text\s+of\s+(.+)$/i.exec(part);
    const subtractFromValue = /^subtract\s+the\s+value\s+of\s+(.+?)\s+from\s+the\s+text\s+of\s+(.+)$/i.exec(part);
    const addText = /^add\s+(-?\d+(?:\.\d+)?)\s+to\s+the\s+text\s+of\s+(.+)$/i.exec(part);
    const subtractText = /^subtract\s+(-?\d+(?:\.\d+)?)\s+from\s+the\s+text\s+of\s+(.+)$/i.exec(part);
    // Increments/decrements a live input's own ".value" directly (as opposed to addText/
    // subtractText, which only ever change what's displayed elsewhere) -- the natural shape
    // for a quantity stepper's "+"/"-" buttons next to a number input. Same fixed-number-only
    // shape and clamp-to-a-real-number semantics as addText/subtractText; the target must have
    // a live value (an input, a text box, or a dropdown), validated the same way setValue is.
    const addToValue = /^add\s+(-?\d+(?:\.\d+)?)\s+to\s+the\s+value\s+of\s+(.+)$/i.exec(part);
    const subtractFromValueAmount = /^subtract\s+(-?\d+(?:\.\d+)?)\s+from\s+the\s+value\s+of\s+(.+)$/i.exec(part);
    // The live-input counterparts of addToValue/subtractFromValueAmount, matching how
    // addFromValue/subtractFromValue already let a live input's value (rather than only a
    // fixed number) drive a text target -- here it drives another live input's own ".value"
    // instead, e.g. copying a stepper's running amount into a second field. Checked before
    // addToValue/subtractFromValueAmount for the same shadowing reason as every other "the
    // value of ..." form, even though "the value of X" would never match \d+ anyway, so the
    // ordering here is defensive rather than strictly load-bearing.
    const addValueToValue = /^add\s+the\s+value\s+of\s+(.+?)\s+to\s+the\s+value\s+of\s+(.+)$/i.exec(part);
    const subtractValueFromValue = !addValueToValue ? /^subtract\s+the\s+value\s+of\s+(.+?)\s+from\s+the\s+value\s+of\s+(.+)$/i.exec(part) : null;
    // The multiplicative siblings of add/subtract -- same fixed-number-only shape (no
    // live-input multiplier yet), same clamp-to-a-real-number semantics via Number(...)||0.
    const multiplyText = /^multiply\s+the\s+text\s+of\s+(.+?)\s+by\s+(-?\d+(?:\.\d+)?)$/i.exec(part);
    const divideText = /^divide\s+the\s+text\s+of\s+(.+?)\s+by\s+(-?\d+(?:\.\d+)?)$/i.exec(part);
    // The live-input counterparts of multiplyText/divideText, matching how addFromValue/
    // subtractFromValue already let a live input's value (rather than only a fixed number)
    // drive the running total. Checked before multiplyText/divideText for the same shadowing
    // reason as every other "the value of ..." form: otherwise "the value of Y" would be read
    // as a (non-numeric, so effectively zero) literal factor instead of a live input's value.
    // Unlike divideText, a zero divisor here can only be caught at runtime (the input's value
    // isn't known until the click actually happens), so the generated code itself guards it.
    const multiplyFromValue = /^multiply\s+the\s+text\s+of\s+(.+?)\s+by\s+the\s+value\s+of\s+(.+)$/i.exec(part);
    const divideFromValue = !multiplyFromValue ? /^divide\s+the\s+text\s+of\s+(.+?)\s+by\s+the\s+value\s+of\s+(.+)$/i.exec(part) : null;
    // The value-target siblings of multiplyText/divideText/multiplyFromValue/divideFromValue
    // -- multiplies/divides a live input's own ".value" in place, rather than only ever some
    // other displayed text, matching how addToValue/subtractFromValueAmount already do this
    // for add/subtract. The live-factor forms are checked first for the same shadowing reason
    // as multiplyFromValue/divideFromValue: otherwise "the value of Y" would be read as a
    // (non-numeric, so effectively zero) literal factor instead of a live input's value.
    const multiplyValueByValue = /^multiply\s+the\s+value\s+of\s+(.+?)\s+by\s+the\s+value\s+of\s+(.+)$/i.exec(part);
    const divideValueByValue = !multiplyValueByValue ? /^divide\s+the\s+value\s+of\s+(.+?)\s+by\s+the\s+value\s+of\s+(.+)$/i.exec(part) : null;
    const multiplyValue = !multiplyValueByValue && !divideValueByValue ?
      /^multiply\s+the\s+value\s+of\s+(.+?)\s+by\s+(-?\d+(?:\.\d+)?)$/i.exec(part) : null;
    const divideValue = !multiplyValueByValue && !divideValueByValue && !multiplyValue ?
      /^divide\s+the\s+value\s+of\s+(.+?)\s+by\s+(-?\d+(?:\.\d+)?)$/i.exec(part) : null;
    // Writes into a live input/textarea/select's own ".value" (as opposed to "set the text
    // of ...", which writes an element's displayed textContent) -- for clearing or presetting
    // a form field from a click, e.g. resetting an input after its value has been used.
    // Checked before the plainer "set the value of X to Y" for the same reason setFromValue
    // is checked before setText: otherwise "the value of Y" would be read as literal text.
    const setValueFromValue = /^set\s+the\s+value\s+of\s+(.+?)\s+to\s+the\s+value\s+of\s+(.+)$/i.exec(part);
    // A dropdown's own ".value" is its selected option's value attribute, which may not match
    // what a visitor actually reads on screen once an option's value diverges from its label
    // (the write-side sibling of "the selected label of ..."). This selects an option by its
    // own displayed text directly, regardless of its value attribute -- checked before the
    // plainer setValue below for the same shadowing reason as setValueFromValue: otherwise
    // "the option labeled X" would be read as a literal, non-matching ".value" string instead.
    const selectByLabel = !setValueFromValue ? /^set\s+the\s+value\s+of\s+(.+?)\s+to\s+the\s+option\s+labeled\s+(.+)$/i.exec(part) : null;
    const setValue = !setValueFromValue && !selectByLabel ? /^set\s+the\s+value\s+of\s+(.+?)\s+to\s+(.+)$/i.exec(part) : null;
    const clearValue = /^clear\s+the\s+value\s+of\s+(.+)$/i.exec(part);
    // Copies one checkbox/radio button's own ".checked" state into another's, so a click can
    // sync two toggles together (e.g. a "match my previous answer" button) without needing a
    // runtime if/otherwise pair to spell out both directions by hand. Checked before the plain
    // "check <name>" form below, for the same shadowing reason as every other "<verb> X the
    // same as Y" vs. "<verb> X" pair in this function: otherwise the plain form's greedy
    // capture would swallow "X the same as Y" whole as a single (invalid) target name.
    const checkMatch = /^check\s+(.+?)\s+the\s+same\s+as\s+(.+)$/i.exec(part);
    // Sets a checkbox/radio button's own ".checked" state directly.
    const checkBox = !checkMatch ? /^check\s+(.+)$/i.exec(part) : null;
    const uncheckBox = /^uncheck\s+(.+)$/i.exec(part);
    // Flips a checkbox/radio button's own ".checked" state without needing to know which way
    // it currently is -- the checked-state sibling of "toggle the visibility of ...", written
    // with its own distinct "toggle whether ... is checked" phrase so it's never confused with
    // that one when skimming a script (both start with "toggle", but read the rest and the
    // target kind is unambiguous either way).
    const toggleChecked = /^toggle\s+whether\s+(.+?)\s+is\s+checked$/i.exec(part);
    // Shows/hides any element by its ".hidden" property (a real, accessible, built-in
    // browser mechanism -- a hidden element is removed from the accessibility tree and
    // stops rendering, unlike a CSS trick that only fools sighted mouse users). Works on
    // any element, not just inputs, since visibility isn't specific to form controls.
    const hideElement = /^hide\s+(.+)$/i.exec(part);
    const showElement = /^show\s+(.+)$/i.exec(part);
    const toggleVisibility = /^toggle\s+the\s+visibility\s+of\s+(.+)$/i.exec(part);
    // Moves keyboard focus to any element -- most useful right after "show"-ing a panel,
    // so a keyboard or screen-reader user lands inside the newly-revealed content instead
    // of being left behind on the button that triggered it.
    const focusElement = /^focus\s+(.+)$/i.exec(part);
    // Enables/disables any form control by its native ".disabled" property -- the same
    // built-in mechanism a browser already uses to skip a control in tab order and grey it
    // out for assistive technology, rather than a fragile CSS-only "looks disabled" trick.
    const disableElement = /^disable\s+(.+)$/i.exec(part);
    const enableElement = /^enable\s+(.+)$/i.exec(part);
    // Switches between "screens" built out of ordinary sections -- no new pseudo-element is
    // introduced; a "screen" is simply any section, the same real HTML element "Add a section
    // called ..." already produces. Resolved against the real DOM at click time (querying the
    // target's own actual siblings), not against a compile-time list of sections seen so far,
    // so it works regardless of which order the sections happen to appear in the source --
    // there's no separate "register this as a screen" step to remember, and a section declared
    // anywhere else in the file is still correctly hidden once this runs.
    const goToSection = /^go\s+to\s+(.+)$/i.exec(part);
    // Brings the single-text scene grammar's own edge-to-edge movement primitive into the
    // Add-based page language -- the first bridge between the two previously-separate
    // rendering models (documented as a limitation up to now). Unlike the scene's absolute-
    // position stage, a page element stays in ordinary document flow the whole time: it's
    // animated with a relative transform (via the Web Animations API, not injected CSS or an
    // inline style, so no new style-src hash is ever needed -- it's just more generated JS,
    // the same security model every other action in this file already uses) sweeping from
    // just off one edge of the viewport to just off the opposite edge, then holding its final
    // position. "Center" is deliberately not offered as an edge here (matching the scene's own
    // movement type, which also excludes it) since a moving element's natural flow position
    // already serves as its own "center". Word-layout ("put each word on a new line") is not
    // brought over by this change -- it requires splitting text into separate DOM nodes, a
    // materially bigger and riskier change than animating an existing element in place, and
    // remains a documented limitation.
    const moveElement = /^move\s+(.+?)\s+from\s+(left|right|top|bottom)\s+to\s+(left|right|top|bottom)\s+over\s+(-?\d+(?:\.\d+)?)\s+seconds?$/i.exec(part);
    // The first bridge from the click language to a backend: fetches a same-origin address
    // as plain text and writes it into an element's own textContent. The address must be a
    // relative path starting with a single "/" (never "//" -- a protocol-relative URL that
    // could reach a different origin -- and never a scheme like "https:", which can't appear
    // here anyway since a leading "/" already rules out "scheme:" syntax); this is what lets
    // the generated page's CSP loosen only to "connect-src 'self'" rather than an unrestricted
    // grant, so the compiled page can never be made to call an arbitrary third-party server.
    // Only a GET request is offered -- there's no instruction for sending a request body, so
    // this can only ever read from a backend, never mutate one, keeping the smallest useful
    // slice of "talk to a backend" as small as it can be. An optional trailing "otherwise ..."
    // runs a fallback instruction (any other supported instruction, recursively compiled, the
    // same "otherwise" already used by every runtime "if") whenever the request fails outright
    // or the response status isn't 2xx -- so a page can show a visitor a clear error instead
    // of silently leaving stale or blank text in place.
    const fetchText = /^fetch\s+the\s+text\s+at\s+(\S+)\s+into\s+the\s+text\s+of\s+(.+?)(?:\s+otherwise\s+(.+))?$/i.exec(part);
    // The next bridge past fetchText's single plain-text read: a generated CRUD backend
    // (see the entity/auth spec language) always replies to a list with JSON shaped
    // {"data":[...]} -- "list" fetches that same-origin address, reads each record's own
    // named fields (its actual column names, sanitized to a plain identifier so nothing but
    // a dotted property read is ever generated), and renders one <li> per record inside a
    // bullet or numbered list, replacing whatever the list held before. It is deliberately
    // read-only and GET-only, the same as fetchText, and shares the same optional trailing
    // "otherwise ..." fallback for a failed request or non-2xx response.
    const listRecords = /^list\s+(.+?)\s+of\s+each\s+record\s+at\s+(\S+)\s+into\s+(.+?)(?:\s+otherwise\s+(.+))?$/i.exec(part);
    // The write-side counterpart: POSTs one JSON object, built only from the exact fields
    // named here and only from other elements' own live ".value" (never arbitrary text), to a
    // same-origin address. A generated CRUD backend always requires a non-empty
    // "Idempotency-Key" header on every create, so one is generated fresh on every click
    // (a plain unique string, not a strict UUID -- the backend only checks it is present and
    // non-empty). This cannot yet drive an authenticated backend's CSRF-protected create,
    // since there is no runtime-variable storage in this language to remember a fetched CSRF
    // token between requests -- that remains a documented follow-up. Shares fetchText/
    // listRecords' own optional trailing "otherwise ..." fallback.
    const createRecord = /^create\s+a\s+record\s+at\s+(\S+)\s+with\s+(.+?)(?:\s+otherwise\s+(.+))?$/i.exec(part);
    if (ifValue) {
      const source = resolve(ifValue[1]!, index);
      if (!source) return undefined;
      if (!hasReadableValue(source.tag)) {
        report(index, `Only an input, a text box, or a dropdown has a value to read, and ${source.name} is a ${englishName(source.tag)}.`,
          `Add an input called ${source.name} instead, such as Add a text input called ${source.name}.`);
        return undefined;
      }
      const operator = clickComparisons[ifValue[2]!.toLowerCase()]!;
      let rightSide: string;
      if (ifValue[3]) {
        const other = resolve(ifValue[3]!, index);
        if (!other) return undefined;
        if (!hasReadableValue(other.tag)) {
          report(index, `Only an input, a text box, or a dropdown has a value to read, and ${other.name} is a ${englishName(other.tag)}.`,
            `Add an input called ${other.name} instead, such as Add a text input called ${other.name}.`);
          return undefined;
        }
        rightSide = `(Number(document.getElementById(${JSON.stringify(other.id)}).value)||0)`;
      } else {
        rightSide = `(${JSON.stringify(Number(ifValue[4]))})`;
      }
      const inner = compileClickPart(ifValue[5]!.trim(), index);
      if (inner === undefined) return undefined;
      let elseClause = "";
      if (ifValue[6]) {
        const elseInner = compileClickPart(ifValue[6].trim(), index);
        if (elseInner === undefined) return undefined;
        elseClause = `else{${elseInner}}`;
      }
      return `if((Number(document.getElementById(${JSON.stringify(source.id)}).value)||0)${operator}${rightSide}){${inner}}${elseClause}`;
    } else if (ifBetween) {
      const source = resolve(ifBetween[1]!, index);
      if (!source) return undefined;
      if (!hasReadableValue(source.tag)) {
        report(index, `Only an input, a text box, or a dropdown has a value to read, and ${source.name} is a ${englishName(source.tag)}.`,
          `Add an input called ${source.name} instead, such as Add a text input called ${source.name}.`);
        return undefined;
      }
      let lowSide: string;
      if (ifBetween[2]) {
        const lowOther = resolve(ifBetween[2]!, index);
        if (!lowOther) return undefined;
        if (!hasReadableValue(lowOther.tag)) {
          report(index, `Only an input, a text box, or a dropdown has a value to read, and ${lowOther.name} is a ${englishName(lowOther.tag)}.`,
            `Add an input called ${lowOther.name} instead, such as Add a text input called ${lowOther.name}.`);
          return undefined;
        }
        lowSide = `(Number(document.getElementById(${JSON.stringify(lowOther.id)}).value)||0)`;
      } else {
        lowSide = `(${JSON.stringify(Number(ifBetween[3]))})`;
      }
      let highSide: string;
      if (ifBetween[4]) {
        const highOther = resolve(ifBetween[4]!, index);
        if (!highOther) return undefined;
        if (!hasReadableValue(highOther.tag)) {
          report(index, `Only an input, a text box, or a dropdown has a value to read, and ${highOther.name} is a ${englishName(highOther.tag)}.`,
            `Add an input called ${highOther.name} instead, such as Add a text input called ${highOther.name}.`);
          return undefined;
        }
        highSide = `(Number(document.getElementById(${JSON.stringify(highOther.id)}).value)||0)`;
      } else {
        highSide = `(${JSON.stringify(Number(ifBetween[5]))})`;
      }
      // A backwards range (e.g. "between 10 and 1") can only be caught at compile time when
      // both ends are still plain numbers -- once either end is a live input's value, the
      // range can only be checked at runtime, so the generated condition itself simply never
      // matches rather than raising a false compile-time error.
      if (!ifBetween[2] && !ifBetween[4]) {
        const low = Number(ifBetween[3]);
        const high = Number(ifBetween[5]);
        if (low > high) {
          report(index, `The range "between ${ifBetween[3]} and ${ifBetween[5]}" is backwards.`,
            `Put the smaller number first, such as "is between ${ifBetween[5]} and ${ifBetween[3]}".`);
          return undefined;
        }
      }
      const inner = compileClickPart(ifBetween[6]!.trim(), index);
      if (inner === undefined) return undefined;
      let elseClause = "";
      if (ifBetween[7]) {
        const elseInner = compileClickPart(ifBetween[7].trim(), index);
        if (elseInner === undefined) return undefined;
        elseClause = `else{${elseInner}}`;
      }
      const value = `(Number(document.getElementById(${JSON.stringify(source.id)}).value)||0)`;
      return `if(${value}>=${lowSide}&&${value}<=${highSide}){${inner}}${elseClause}`;
    } else if (ifLength) {
      const source = resolve(ifLength[1]!, index);
      if (!source) return undefined;
      if (!hasReadableValue(source.tag)) {
        report(index, `Only an input, a text box, or a dropdown has a value to read, and ${source.name} is a ${englishName(source.tag)}.`,
          `Add an input called ${source.name} instead, such as Add a text input called ${source.name}.`);
        return undefined;
      }
      const operator = lengthComparisons[ifLength[2]!.toLowerCase()]!;
      let rightSide: string;
      if (ifLength[3]) {
        const other = resolve(ifLength[3]!, index);
        if (!other) return undefined;
        if (!hasReadableValue(other.tag)) {
          report(index, `Only an input, a text box, or a dropdown has a value to read, and ${other.name} is a ${englishName(other.tag)}.`,
            `Add an input called ${other.name} instead, such as Add a text input called ${other.name}.`);
          return undefined;
        }
        rightSide = `String(document.getElementById(${JSON.stringify(other.id)}).value).length`;
      } else {
        rightSide = JSON.stringify(Number(ifLength[4]));
      }
      const inner = compileClickPart(ifLength[5]!.trim(), index);
      if (inner === undefined) return undefined;
      let elseClause = "";
      if (ifLength[6]) {
        const elseInner = compileClickPart(ifLength[6].trim(), index);
        if (elseInner === undefined) return undefined;
        elseClause = `else{${elseInner}}`;
      }
      return `if(String(document.getElementById(${JSON.stringify(source.id)}).value).length${operator}${rightSide}){${inner}}${elseClause}`;
    } else if (ifText) {
      const source = resolve(ifText[1]!, index);
      if (!source) return undefined;
      if (!hasReadableValue(source.tag)) {
        report(index, `Only an input, a text box, or a dropdown has a value to read, and ${source.name} is a ${englishName(source.tag)}.`,
          `Add an input called ${source.name} instead, such as Add a text input called ${source.name}.`);
        return undefined;
      }
      const op = ifText[2]!.toLowerCase();
      let rightSide: string;
      if (ifText[3]) {
        const other = resolve(ifText[3]!, index);
        if (!other) return undefined;
        if (!hasReadableValue(other.tag)) {
          report(index, `Only an input, a text box, or a dropdown has a value to read, and ${other.name} is a ${englishName(other.tag)}.`,
            `Add an input called ${other.name} instead, such as Add a text input called ${other.name}.`);
          return undefined;
        }
        rightSide = `String(document.getElementById(${JSON.stringify(other.id)}).value)`;
      } else {
        rightSide = JSON.stringify(dequoteRuntime(ifText[4]!.trim()));
      }
      const left = `String(document.getElementById(${JSON.stringify(source.id)}).value)`;
      const inner = compileClickPart(ifText[5]!.trim(), index);
      if (inner === undefined) return undefined;
      let elseClause = "";
      if (ifText[6]) {
        const elseInner = compileClickPart(ifText[6].trim(), index);
        if (elseInner === undefined) return undefined;
        elseClause = `else{${elseInner}}`;
      }
      return `if(${textComparisons[op]!(left, rightSide)}){${inner}}${elseClause}`;
    } else if (ifLabel) {
      const source = resolve(ifLabel[1]!, index);
      if (!source) return undefined;
      if (source.tag !== "select") {
        report(index, `Only a dropdown has a selected option's label, and ${source.name} is a ${englishName(source.tag)}.`,
          `Add a dropdown called ${source.name} instead, such as Add a dropdown called ${source.name}.`);
        return undefined;
      }
      const op = ifLabel[2]!.toLowerCase();
      const left = `(function(){var s=document.getElementById(${JSON.stringify(source.id)});return s.options[s.selectedIndex]?s.options[s.selectedIndex].text:"";})()`;
      let rightSide: string;
      if (ifLabel[3]) {
        const other = resolve(ifLabel[3]!, index);
        if (!other) return undefined;
        if (other.tag !== "select") {
          report(index, `Only a dropdown has a selected option's label, and ${other.name} is a ${englishName(other.tag)}.`,
            `Add a dropdown called ${other.name} instead, such as Add a dropdown called ${other.name}.`);
          return undefined;
        }
        rightSide = `(function(){var s=document.getElementById(${JSON.stringify(other.id)});return s.options[s.selectedIndex]?s.options[s.selectedIndex].text:"";})()`;
      } else {
        rightSide = JSON.stringify(dequoteRuntime(ifLabel[4]!.trim()));
      }
      const inner = compileClickPart(ifLabel[5]!.trim(), index);
      if (inner === undefined) return undefined;
      let elseClause = "";
      if (ifLabel[6]) {
        const elseInner = compileClickPart(ifLabel[6].trim(), index);
        if (elseInner === undefined) return undefined;
        elseClause = `else{${elseInner}}`;
      }
      return `if(${textComparisons[op]!(left, rightSide)}){${inner}}${elseClause}`;
    } else if (ifCheckedMatch) {
      const source = resolve(ifCheckedMatch[1]!, index);
      if (!source) return undefined;
      if (!hasCheckedState(source)) {
        report(index, `Only a checkbox or a radio button has a checked state, and ${source.name} is a ${englishName(source.tag)}.`,
          `Add a checkbox called ${source.name} instead, such as Add a checkbox called ${source.name}.`);
        return undefined;
      }
      const other = resolve(ifCheckedMatch[3]!, index);
      if (!other) return undefined;
      if (!hasCheckedState(other)) {
        report(index, `Only a checkbox or a radio button has a checked state, and ${other.name} is a ${englishName(other.tag)}.`,
          `Add a checkbox called ${other.name} instead, such as Add a checkbox called ${other.name}.`);
        return undefined;
      }
      const negate = ifCheckedMatch[2] ? "!" : "";
      const inner = compileClickPart(ifCheckedMatch[4]!.trim(), index);
      if (inner === undefined) return undefined;
      let elseClause = "";
      if (ifCheckedMatch[5]) {
        const elseInner = compileClickPart(ifCheckedMatch[5].trim(), index);
        if (elseInner === undefined) return undefined;
        elseClause = `else{${elseInner}}`;
      }
      return `if(${negate}(document.getElementById(${JSON.stringify(source.id)}).checked===document.getElementById(${JSON.stringify(other.id)}).checked)){${inner}}${elseClause}`;
    } else if (ifChecked) {
      const source = resolve(ifChecked[1]!, index);
      if (!source) return undefined;
      if (!hasCheckedState(source)) {
        report(index, `Only a checkbox or a radio button has a checked state, and ${source.name} is a ${englishName(source.tag)}.`,
          `Add a checkbox called ${source.name} instead, such as Add a checkbox called ${source.name}.`);
        return undefined;
      }
      const negate = ifChecked[2]!.toLowerCase() === "not checked" ? "!" : "";
      const inner = compileClickPart(ifChecked[3]!.trim(), index);
      if (inner === undefined) return undefined;
      let elseClause = "";
      if (ifChecked[4]) {
        const elseInner = compileClickPart(ifChecked[4].trim(), index);
        if (elseInner === undefined) return undefined;
        elseClause = `else{${elseInner}}`;
      }
      return `if(${negate}document.getElementById(${JSON.stringify(source.id)}).checked){${inner}}${elseClause}`;
    } else if (ifDisabled) {
      const source = resolve(ifDisabled[1]!, index);
      if (!source) return undefined;
      if (!hasDisabledSupport(source.tag)) {
        report(index, `Only a button, an input, a text box, a dropdown, or a field group can be disabled, and ${source.name} is a ${englishName(source.tag)}.`,
          `Add an input called ${source.name} instead, such as Add a text input called ${source.name}.`);
        return undefined;
      }
      const negate = ifDisabled[2]!.toLowerCase() === "not disabled" ? "!" : "";
      const inner = compileClickPart(ifDisabled[3]!.trim(), index);
      if (inner === undefined) return undefined;
      let elseClause = "";
      if (ifDisabled[4]) {
        const elseInner = compileClickPart(ifDisabled[4].trim(), index);
        if (elseInner === undefined) return undefined;
        elseClause = `else{${elseInner}}`;
      }
      return `if(${negate}document.getElementById(${JSON.stringify(source.id)}).disabled){${inner}}${elseClause}`;
    } else if (repeat) {
      if (repeat[1]) {
        const source = resolve(repeat[1]!, index);
        if (!source) return undefined;
        if (!hasReadableValue(source.tag)) {
          report(index, `Only an input, a text box, or a dropdown has a value to read, and ${source.name} is a ${englishName(source.tag)}.`,
            `Add an input called ${source.name} instead, such as Add a text input called ${source.name}.`);
          return undefined;
        }
        const inner = compileClickPart(repeat[3]!.trim(), index);
        if (inner === undefined) return undefined;
        // A live count can't be range-checked at compile time -- it isn't known until the
        // click actually happens -- so the generated code itself clamps it into the same
        // [0, 100000] bound the fixed-number form already enforces at compile time, rather
        // than letting a huge or negative typed value hang or silently loop zero times for
        // the wrong reason.
        return `for(let i=0,n=Math.min(100000,Math.max(0,Number(document.getElementById(${JSON.stringify(source.id)}).value)||0));i<n;i++){${inner}}`;
      }
      const count = Number(repeat[2]);
      if (count < 0) {
        report(index, `"Repeat ${count} times" needs a count of 0 or more.`,
          `Use a non-negative number, such as "repeat 3 times, ...".`);
        return undefined;
      }
      if (count > 100_000) {
        report(index, `"Repeat ${count} times" can run at most 100000 times per click.`,
          "Use a smaller count.");
        return undefined;
      }
      const inner = compileClickPart(repeat[3]!.trim(), index);
      if (inner === undefined) return undefined;
      // A block-scoped "let" (rather than "var") gives each repeat loop, even a nested one,
      // its own counter, so "repeat ..., repeat ..., ..." never has an inner loop's counter
      // stomp an outer loop's counter of the same name.
      return `for(let i=0;i<${JSON.stringify(count)};i++){${inner}}`;
    } else if (setFromValue) {
      const target = resolve(setFromValue[1]!, index);
      const source = target ? resolve(setFromValue[2]!, index) : undefined;
      if (!target || !source) return undefined;
      if (!hasReadableValue(source.tag)) {
        report(index, `Only an input, a text box, or a dropdown has a value to read, and ${source.name} is a ${englishName(source.tag)}.`,
          `Add an input called ${source.name} instead, such as Add a text input called ${source.name}.`);
        return undefined;
      }
      return `document.getElementById(${JSON.stringify(target.id)}).textContent=document.getElementById(${JSON.stringify(source.id)}).value;`;
    } else if (setFromLength) {
      const target = resolve(setFromLength[1]!, index);
      const source = target ? resolve(setFromLength[2]!, index) : undefined;
      if (!target || !source) return undefined;
      if (!hasReadableValue(source.tag)) {
        report(index, `Only an input, a text box, or a dropdown has a value to read, and ${source.name} is a ${englishName(source.tag)}.`,
          `Add an input called ${source.name} instead, such as Add a text input called ${source.name}.`);
        return undefined;
      }
      return `document.getElementById(${JSON.stringify(target.id)}).textContent=String(document.getElementById(${JSON.stringify(source.id)}).value.length);`;
    } else if (setFromLabel) {
      const target = resolve(setFromLabel[1]!, index);
      const source = target ? resolve(setFromLabel[2]!, index) : undefined;
      if (!target || !source) return undefined;
      if (source.tag !== "select") {
        report(index, `Only a dropdown has a selected option's label, and ${source.name} is a ${englishName(source.tag)}.`,
          `Add a dropdown called ${source.name} instead, such as Add a dropdown called ${source.name}.`);
        return undefined;
      }
      return `document.getElementById(${JSON.stringify(target.id)}).textContent=(function(){var s=document.getElementById(${JSON.stringify(source.id)});return s.options[s.selectedIndex]?s.options[s.selectedIndex].text:"";})();`;
    } else if (addFromValue || subtractFromValue) {
      const match = addFromValue ?? subtractFromValue!;
      const source = resolve(match[1]!, index);
      const target = source ? resolve(match[2]!, index) : undefined;
      if (!source || !target) return undefined;
      if (!hasReadableValue(source.tag)) {
        report(index, `Only an input, a text box, or a dropdown has a value to read, and ${source.name} is a ${englishName(source.tag)}.`,
          `Add an input called ${source.name} instead, such as Add a text input called ${source.name}.`);
        return undefined;
      }
      const sign = addFromValue ? "" : "-";
      return `(function(){var e=document.getElementById(${JSON.stringify(target.id)});` +
        `e.textContent=String((Number(e.textContent)||0)+(${sign}(Number(document.getElementById(${JSON.stringify(source.id)}).value)||0)));})();`;
    } else if (multiplyFromValue || divideFromValue) {
      const match = multiplyFromValue ?? divideFromValue!;
      const target = resolve(match[1]!, index);
      const source = target ? resolve(match[2]!, index) : undefined;
      if (!target || !source) return undefined;
      if (!hasReadableValue(source.tag)) {
        report(index, `Only an input, a text box, or a dropdown has a value to read, and ${source.name} is a ${englishName(source.tag)}.`,
          `Add an input called ${source.name} instead, such as Add a text input called ${source.name}.`);
        return undefined;
      }
      const operator = multiplyFromValue ? "*" : "/";
      const zeroGuard = divideFromValue ? "if(f===0)return;" : "";
      // Unlike the fixed-number divideText, a zero divisor can't be caught at compile time
      // here -- the input's value isn't known until the click happens -- so the generated
      // code itself guards against it at runtime, leaving the running total unchanged rather
      // than producing NaN/Infinity.
      return `(function(){var e=document.getElementById(${JSON.stringify(target.id)});` +
        `var f=Number(document.getElementById(${JSON.stringify(source.id)}).value)||0;${zeroGuard}` +
        `e.textContent=String((Number(e.textContent)||0)${operator}f);})();`;
    } else if (setRandom) {
      const target = resolve(setRandom[1]!, index);
      if (!target) return undefined;
      let loExpr: string;
      if (setRandom[2]) {
        const loSource = resolve(setRandom[2]!, index);
        if (!loSource) return undefined;
        if (!hasReadableValue(loSource.tag)) {
          report(index, `Only an input, a text box, or a dropdown has a value to read, and ${loSource.name} is a ${englishName(loSource.tag)}.`,
            `Add an input called ${loSource.name} instead, such as Add a text input called ${loSource.name}.`);
          return undefined;
        }
        loExpr = `(Number(document.getElementById(${JSON.stringify(loSource.id)}).value)||0)`;
      } else {
        loExpr = `(${JSON.stringify(Number(setRandom[3]))})`;
      }
      let hiExpr: string;
      if (setRandom[4]) {
        const hiSource = resolve(setRandom[4]!, index);
        if (!hiSource) return undefined;
        if (!hasReadableValue(hiSource.tag)) {
          report(index, `Only an input, a text box, or a dropdown has a value to read, and ${hiSource.name} is a ${englishName(hiSource.tag)}.`,
            `Add an input called ${hiSource.name} instead, such as Add a text input called ${hiSource.name}.`);
          return undefined;
        }
        hiExpr = `(Number(document.getElementById(${JSON.stringify(hiSource.id)}).value)||0)`;
      } else {
        hiExpr = `(${JSON.stringify(Number(setRandom[5]))})`;
      }
      // The backwards-range compile-time error only applies when both ends are still plain
      // numbers -- once either end is a live input's value, the actual order can only be
      // known at runtime, so the generated code itself takes the min/max of both evaluated
      // ends instead of assuming which one is the low end.
      if (!setRandom[2] && !setRandom[4]) {
        const min = Number(setRandom[3]);
        const max = Number(setRandom[5]);
        if (min > max) {
          report(index, `A random range's low end (${min}) can't be greater than its high end (${max}).`,
            `Try "a random number from ${max} to ${min}" instead.`);
          return undefined;
        }
        return `document.getElementById(${JSON.stringify(target.id)}).textContent=String(Math.floor(Math.random()*(${JSON.stringify(max - min + 1)}))+(${JSON.stringify(min)}));`;
      }
      return `(function(){var lo=${loExpr};var hi=${hiExpr};var min=Math.min(lo,hi);var max=Math.max(lo,hi);` +
        `document.getElementById(${JSON.stringify(target.id)}).textContent=String(Math.floor(Math.random()*(max-min+1))+min);})();`;
    } else if (setText) {
      const target = resolve(setText[1]!, index);
      if (!target) return undefined;
      return `document.getElementById(${JSON.stringify(target.id)}).textContent=${JSON.stringify(dequoteRuntime(setText[2]!))};`;
    } else if (addText || subtractText) {
      const match = addText ?? subtractText!;
      const target = resolve(match[2]!, index);
      if (!target) return undefined;
      const amount = (addText ? 1 : -1) * Number(match[1]);
      return `(function(){var e=document.getElementById(${JSON.stringify(target.id)});` +
        `e.textContent=String((Number(e.textContent)||0)+(${JSON.stringify(amount)}));})();`;
    } else if (addValueToValue || subtractValueFromValue) {
      const match = addValueToValue ?? subtractValueFromValue!;
      const source = resolve(match[1]!, index);
      const target = source ? resolve(match[2]!, index) : undefined;
      if (!source || !target) return undefined;
      if (!hasReadableValue(source.tag)) {
        report(index, `Only an input, a text box, or a dropdown has a value to read, and ${source.name} is a ${englishName(source.tag)}.`,
          `Add an input called ${source.name} instead, such as Add a text input called ${source.name}.`);
        return undefined;
      }
      if (!hasReadableValue(target.tag)) {
        report(index, `Only an input, a text box, or a dropdown has a value to set, and ${target.name} is a ${englishName(target.tag)}.`,
          `Add an input called ${target.name} instead, such as Add a text input called ${target.name}.`);
        return undefined;
      }
      const sign = addValueToValue ? "" : "-";
      return `(function(){var e=document.getElementById(${JSON.stringify(target.id)});` +
        `e.value=String((Number(e.value)||0)+(${sign}(Number(document.getElementById(${JSON.stringify(source.id)}).value)||0)));})();`;
    } else if (addToValue || subtractFromValueAmount) {
      const match = addToValue ?? subtractFromValueAmount!;
      const target = resolve(match[2]!, index);
      if (!target) return undefined;
      if (!hasReadableValue(target.tag)) {
        report(index, `Only an input, a text box, or a dropdown has a value to set, and ${target.name} is a ${englishName(target.tag)}.`,
          `Add an input called ${target.name} instead, such as Add a text input called ${target.name}.`);
        return undefined;
      }
      const amount = (addToValue ? 1 : -1) * Number(match[1]);
      return `(function(){var e=document.getElementById(${JSON.stringify(target.id)});` +
        `e.value=String((Number(e.value)||0)+(${JSON.stringify(amount)}));})();`;
    } else if (multiplyValueByValue || divideValueByValue) {
      const match = multiplyValueByValue ?? divideValueByValue!;
      const target = resolve(match[1]!, index);
      const source = target ? resolve(match[2]!, index) : undefined;
      if (!target || !source) return undefined;
      if (!hasReadableValue(target.tag)) {
        report(index, `Only an input, a text box, or a dropdown has a value to set, and ${target.name} is a ${englishName(target.tag)}.`,
          `Add an input called ${target.name} instead, such as Add a text input called ${target.name}.`);
        return undefined;
      }
      if (!hasReadableValue(source.tag)) {
        report(index, `Only an input, a text box, or a dropdown has a value to read, and ${source.name} is a ${englishName(source.tag)}.`,
          `Add an input called ${source.name} instead, such as Add a text input called ${source.name}.`);
        return undefined;
      }
      const operator = multiplyValueByValue ? "*" : "/";
      const zeroGuard = divideValueByValue ? "if(f===0)return;" : "";
      // Same as divideFromValue: a live divisor can only be caught at runtime, so the
      // generated code itself guards against it, leaving the target's value unchanged rather
      // than producing NaN/Infinity.
      return `(function(){var e=document.getElementById(${JSON.stringify(target.id)});` +
        `var f=Number(document.getElementById(${JSON.stringify(source.id)}).value)||0;${zeroGuard}` +
        `e.value=String((Number(e.value)||0)${operator}f);})();`;
    } else if (multiplyValue || divideValue) {
      const match = multiplyValue ?? divideValue!;
      const target = resolve(match[1]!, index);
      if (!target) return undefined;
      if (!hasReadableValue(target.tag)) {
        report(index, `Only an input, a text box, or a dropdown has a value to set, and ${target.name} is a ${englishName(target.tag)}.`,
          `Add an input called ${target.name} instead, such as Add a text input called ${target.name}.`);
        return undefined;
      }
      const factor = Number(match[2]);
      if (divideValue && factor === 0) {
        report(index, `"Divide ... by 0" would produce an undefined result.`,
          "Use a non-zero number to divide by.");
        return undefined;
      }
      const operator = multiplyValue ? "*" : "/";
      return `(function(){var e=document.getElementById(${JSON.stringify(target.id)});` +
        `e.value=String((Number(e.value)||0)${operator}(${JSON.stringify(factor)}));})();`;
    } else if (multiplyText || divideText) {
      const match = multiplyText ?? divideText!;
      const target = resolve(match[1]!, index);
      if (!target) return undefined;
      const factor = Number(match[2]);
      if (divideText && factor === 0) {
        report(index, `"Divide ... by 0" would produce an undefined result.`,
          "Use a non-zero number to divide by.");
        return undefined;
      }
      const operator = multiplyText ? "*" : "/";
      return `(function(){var e=document.getElementById(${JSON.stringify(target.id)});` +
        `e.textContent=String((Number(e.textContent)||0)${operator}(${JSON.stringify(factor)}));})();`;
    } else if (setValueFromValue) {
      const target = resolve(setValueFromValue[1]!, index);
      const source = target ? resolve(setValueFromValue[2]!, index) : undefined;
      if (!target || !source) return undefined;
      if (!hasReadableValue(target.tag)) {
        report(index, `Only an input, a text box, or a dropdown has a value to set, and ${target.name} is a ${englishName(target.tag)}.`,
          `Add an input called ${target.name} instead, such as Add a text input called ${target.name}.`);
        return undefined;
      }
      if (!hasReadableValue(source.tag)) {
        report(index, `Only an input, a text box, or a dropdown has a value to read, and ${source.name} is a ${englishName(source.tag)}.`,
          `Add an input called ${source.name} instead, such as Add a text input called ${source.name}.`);
        return undefined;
      }
      return `document.getElementById(${JSON.stringify(target.id)}).value=document.getElementById(${JSON.stringify(source.id)}).value;`;
    } else if (selectByLabel) {
      const target = resolve(selectByLabel[1]!, index);
      if (!target) return undefined;
      if (target.tag !== "select") {
        report(index, `Only a dropdown has options with labels, and ${target.name} is a ${englishName(target.tag)}.`,
          `Add a dropdown called ${target.name} instead, such as Add a dropdown called ${target.name}.`);
        return undefined;
      }
      const label = dequoteRuntime(selectByLabel[2]!);
      return `(function(){var s=document.getElementById(${JSON.stringify(target.id)});` +
        `for(var i=0;i<s.options.length;i++){if(s.options[i].text===${JSON.stringify(label)}){s.selectedIndex=i;break;}}})();`;
    } else if (setValue) {
      const target = resolve(setValue[1]!, index);
      if (!target) return undefined;
      if (!hasReadableValue(target.tag)) {
        report(index, `Only an input, a text box, or a dropdown has a value to set, and ${target.name} is a ${englishName(target.tag)}.`,
          `Add an input called ${target.name} instead, such as Add a text input called ${target.name}.`);
        return undefined;
      }
      return `document.getElementById(${JSON.stringify(target.id)}).value=${JSON.stringify(dequoteRuntime(setValue[2]!))};`;
    } else if (clearValue) {
      const target = resolve(clearValue[1]!, index);
      if (!target) return undefined;
      if (!hasReadableValue(target.tag)) {
        report(index, `Only an input, a text box, or a dropdown has a value to clear, and ${target.name} is a ${englishName(target.tag)}.`,
          `Add an input called ${target.name} instead, such as Add a text input called ${target.name}.`);
        return undefined;
      }
      return `document.getElementById(${JSON.stringify(target.id)}).value="";`;
    } else if (checkMatch) {
      const target = resolve(checkMatch[1]!, index);
      if (!target) return undefined;
      if (!hasCheckedState(target)) {
        report(index, `Only a checkbox or a radio button has a checked state, and ${target.name} is a ${englishName(target.tag)}.`,
          `Add a checkbox called ${target.name} instead, such as Add a checkbox called ${target.name}.`);
        return undefined;
      }
      const other = resolve(checkMatch[2]!, index);
      if (!other) return undefined;
      if (!hasCheckedState(other)) {
        report(index, `Only a checkbox or a radio button has a checked state, and ${other.name} is a ${englishName(other.tag)}.`,
          `Add a checkbox called ${other.name} instead, such as Add a checkbox called ${other.name}.`);
        return undefined;
      }
      return `document.getElementById(${JSON.stringify(target.id)}).checked=document.getElementById(${JSON.stringify(other.id)}).checked;`;
    } else if (checkBox || uncheckBox || toggleChecked) {
      const match = checkBox ?? uncheckBox ?? toggleChecked!;
      const target = resolve(match[1]!, index);
      if (!target) return undefined;
      if (!hasCheckedState(target)) {
        report(index, `Only a checkbox or a radio button has a checked state, and ${target.name} is a ${englishName(target.tag)}.`,
          `Add a checkbox called ${target.name} instead, such as Add a checkbox called ${target.name}.`);
        return undefined;
      }
      if (toggleChecked) return `(function(){var e=document.getElementById(${JSON.stringify(target.id)});e.checked=!e.checked;})();`;
      return `document.getElementById(${JSON.stringify(target.id)}).checked=${checkBox ? "true" : "false"};`;
    } else if (hideElement || showElement) {
      const match = hideElement ?? showElement!;
      const target = resolve(match[1]!, index);
      if (!target) return undefined;
      return `document.getElementById(${JSON.stringify(target.id)}).hidden=${hideElement ? "true" : "false"};`;
    } else if (toggleVisibility) {
      const target = resolve(toggleVisibility[1]!, index);
      if (!target) return undefined;
      return `(function(){var e=document.getElementById(${JSON.stringify(target.id)});e.hidden=!e.hidden;})();`;
    } else if (focusElement) {
      const target = resolve(focusElement[1]!, index);
      if (!target) return undefined;
      return `document.getElementById(${JSON.stringify(target.id)}).focus();`;
    } else if (disableElement || enableElement) {
      const match = disableElement ?? enableElement!;
      const target = resolve(match[1]!, index);
      if (!target) return undefined;
      if (!hasDisabledSupport(target.tag)) {
        report(index, `Only a button, an input, a text box, a dropdown, or a field group can be disabled, and ${target.name} is a ${englishName(target.tag)}.`,
          `Add a button called ${target.name} instead, such as Add a button called ${target.name}.`);
        return undefined;
      }
      return `document.getElementById(${JSON.stringify(target.id)}).disabled=${disableElement ? "true" : "false"};`;
    } else if (goToSection) {
      const target = resolve(goToSection[1]!, index);
      if (!target) return undefined;
      if (target.tag !== "section") {
        report(index, `Only a section can be navigated to, and ${target.name} is a ${englishName(target.tag)}.`,
          `Add a section called ${target.name} instead, such as Add a section called ${target.name}.`);
        return undefined;
      }
      return `(function(){var t=document.getElementById(${JSON.stringify(target.id)});var sibs=t.parentElement?t.parentElement.children:[];` +
        `for(var i=0;i<sibs.length;i++){if(sibs[i].tagName==="SECTION")sibs[i].hidden=sibs[i]!==t;}})();`;
    } else if (moveElement) {
      const target = resolve(moveElement[1]!, index);
      if (!target) return undefined;
      const from = moveElement[2]!.toLowerCase();
      const to = moveElement[3]!.toLowerCase();
      const opposite: Record<string, string> = { left: "right", right: "left", top: "bottom", bottom: "top" };
      if (opposite[from] !== to) {
        report(index, `A move must run between opposite edges, and ${from} to ${to} is not one of them.`,
          "Use left to right, right to left, top to bottom, or bottom to top.");
        return undefined;
      }
      const seconds = Number(moveElement[4]);
      if (seconds < 0.1 || seconds > 60) {
        report(index, "Movement duration must be between 0.1 and 60 seconds.",
          `Try: move ${target.name} from ${from} to ${to} over 3 seconds.`);
        return undefined;
      }
      // Each edge is a transform relative to the element's own natural document-flow position
      // (not an absolute page position, unlike the single-text scene), so the element sweeps
      // just off one side of the viewport to just off the opposite side without ever leaving
      // normal document flow. Uses the Web Animations API, not injected CSS or an inline
      // style, so no new CSP style-src hash is ever needed here -- purely more generated JS,
      // the same security model every other action in this file already relies on.
      const offset: Record<string, string> = {
        left: "translateX(-100vw)", right: "translateX(100vw)", top: "translateY(-100vh)", bottom: "translateY(100vh)"
      };
      return `(function(){var e=document.getElementById(${JSON.stringify(target.id)});` +
        `if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches){return;}` +
        `e.animate([{transform:${JSON.stringify(offset[from]!)}},{transform:${JSON.stringify(offset[to]!)}}],` +
        `{duration:${Math.round(seconds * 1000)},fill:"forwards"});})();`;
    } else if (fetchText) {
      const path = fetchText[1]!;
      if (!isSameOriginPath(path)) {
        report(index, `"${path}" must be a same-origin address, starting with a single "/" and not "//".`,
          "Try fetch the text at /status into the text of result -- an external or protocol-relative address is not allowed.");
        return undefined;
      }
      const target = resolve(fetchText[2]!, index);
      if (!target) return undefined;
      let onFail = "";
      if (fetchText[3]) {
        const compiledFallback = compileClickPart(fetchText[3].trim(), index);
        if (compiledFallback === undefined) return undefined;
        onFail = compiledFallback;
      }
      usesFetch = true;
      return `fetch(${JSON.stringify(path)}).then(function(r){if(!r.ok){throw new Error("");}return r.text();})` +
        `.then(function(t){document.getElementById(${JSON.stringify(target.id)}).textContent=t;}).catch(function(){${onFail}});`;
    } else if (listRecords) {
      const path = listRecords[2]!;
      if (!isSameOriginPath(path)) {
        report(index, `"${path}" must be a same-origin address, starting with a single "/" and not "//".`,
          "Try list name of each record at /players into player list -- an external or protocol-relative address is not allowed.");
        return undefined;
      }
      const container = resolve(listRecords[3]!, index);
      if (!container) return undefined;
      if (container.tag !== "ul" && container.tag !== "ol") {
        report(index, `Only a bullet list or a numbered list can show a list of records, and ${container.name} is a ${englishName(container.tag)}.`,
          `Add a bullet list called ${container.name} instead, such as Add a bullet list called ${container.name}.`);
        return undefined;
      }
      const fields = splitFieldNames(listRecords[1]!);
      if (!fields.length) {
        report(index, "List at least one field, such as name.", "Try list name of each record at /players into player list.");
        return undefined;
      }
      const badField = fields.find((field) => !isPlainFieldName(field));
      if (badField) {
        report(index, `"${badField}" is not a plain field name (letters, digits, and underscores only).`,
          "Field names come from the backend record's own keys, such as name or email.");
        return undefined;
      }
      let onFail = "";
      if (listRecords[4]) {
        const compiledFallback = compileClickPart(listRecords[4].trim(), index);
        if (compiledFallback === undefined) return undefined;
        onFail = compiledFallback;
      }
      usesFetch = true;
      const rowText = fields.map((field) => `(item.${field}==null?"":item.${field})`).join('+", "+');
      return `fetch(${JSON.stringify(path)}).then(function(r){if(!r.ok){throw new Error("");}return r.json();})` +
        `.then(function(j){var items=(j&&j.data)||[];var c=document.getElementById(${JSON.stringify(container.id)});c.innerHTML="";` +
        `items.forEach(function(item){var li=document.createElement("li");li.textContent=${rowText};c.appendChild(li);});}).catch(function(){${onFail}});`;
    } else if (createRecord) {
      const path = createRecord[1]!;
      if (!isSameOriginPath(path)) {
        report(index, `"${path}" must be a same-origin address, starting with a single "/" and not "//".`,
          "Try create a record at /players with name set to the value of name input -- an external or protocol-relative address is not allowed.");
        return undefined;
      }
      const pairs = splitFieldValuePairs(createRecord[2]!);
      if (!pairs.length) {
        report(index, "Set at least one field, such as name set to the value of name input.",
          "Try create a record at /players with name set to the value of name input.");
        return undefined;
      }
      const seen = new Set<string>();
      const fieldExprs: string[] = [];
      for (const pair of pairs) {
        const match = /^([a-zA-Z_][a-zA-Z0-9_]*)\s+set\s+to\s+the\s+value\s+of\s+(.+)$/i.exec(pair);
        if (!match) {
          report(index, `"${pair}" is not a plain field, such as name set to the value of name input.`,
            "Try create a record at /players with name set to the value of name input.");
          return undefined;
        }
        const field = match[1]!;
        if (seen.has(field)) {
          report(index, `More than one field sets ${field}.`, "Set each field only once.");
          return undefined;
        }
        seen.add(field);
        const valueSource = resolve(match[2]!, index);
        if (!valueSource) return undefined;
        if (!hasReadableValue(valueSource.tag)) {
          report(index, `Only an input, a text box, or a dropdown has a value to read, and ${valueSource.name} is a ${englishName(valueSource.tag)}.`,
            `Add an input called ${valueSource.name} instead, such as Add a text input called ${valueSource.name}.`);
          return undefined;
        }
        fieldExprs.push(`${JSON.stringify(field)}:document.getElementById(${JSON.stringify(valueSource.id)}).value`);
      }
      let onFail = "";
      if (createRecord[3]) {
        const compiledFallback = compileClickPart(createRecord[3].trim(), index);
        if (compiledFallback === undefined) return undefined;
        onFail = compiledFallback;
      }
      usesFetch = true;
      return `fetch(${JSON.stringify(path)},{method:"POST",headers:{"Content-Type":"application/json",` +
        `"Idempotency-Key":String(Date.now())+"-"+Math.random().toString(36).slice(2)},` +
        `body:JSON.stringify({${fieldExprs.join(",")}})}).then(function(r){if(!r.ok){throw new Error("");}}).catch(function(){${onFail}});`;
    }
    report(index, `"${part}" is not one of the supported click instructions.`,
      `Try "set the text of ... to ...", "set the text of ... to the value of ...", ` +
      `"set the text of ... to the selected label of ... (a dropdown)", ` +
      `"set the text of ... to the number of characters in the value of ...", ` +
      `"set the text of ... to a random number from ... to ... (two numbers, or the value of ..., or a mix)", "add ... to the text of ...", ` +
      `"subtract ... from the text of ...", "multiply the text of ... by ...", ` +
      `"divide the text of ... by ...", "add the value of ... to the text of ...", ` +
      `"subtract the value of ... from the text of ...", "multiply the text of ... by the value of ...", ` +
      `"divide the text of ... by the value of ...", "add ... to the value of ...", ` +
      `"subtract ... from the value of ...", "add the value of ... to the value of ...", ` +
      `"subtract the value of ... from the value of ...", "multiply the value of ... by ...", ` +
      `"divide the value of ... by ...", "multiply the value of ... by the value of ...", ` +
      `"divide the value of ... by the value of ...", "set the value of ... to ...", ` +
      `"set the value of ... to the value of ...", "set the value of ... to the option labeled ... (a dropdown)", "clear the value of ...", ` +
      `"check ..."/"uncheck ..." for a checkbox or radio button, ` +
      `"check ... the same as ..." to copy another checkbox or radio button's checked state, ` +
      `"toggle whether ... is checked" for a checkbox or radio button, ` +
      `"hide ...", "show ...", "toggle the visibility of ...", "focus ...", ` +
      `"disable ...", "enable ..." for a button, input, text box, dropdown, or field group, ` +
      `"go to ..." to switch to a section, hiding its sibling sections, ` +
      `"move ... from left/right/top/bottom to the opposite edge over ... seconds" to animate any element across the screen, ` +
      `"fetch the text at /a-same-origin-address into the text of ..., otherwise ..." to read from a backend, ` +
      `"list <field>, <field> and <field> of each record at /a-same-origin-address into ... (a bullet or numbered list), otherwise ..." to render backend records, ` +
      `"create a record at /a-same-origin-address with <field> set to the value of ..., and <field> set to the value of ..., otherwise ..." to POST a new record, ` +
      `"if the value of ... is greater than/less than/` +
      `at least/at most/equal to/not equal to (a number or the value of ...), ... otherwise ...", ` +
      `"if the value of ... is between ... and ... (two numbers, or the value of ..., or a mix), ... otherwise ...", ` +
      `"if the value of ... has more than/fewer than/at least/at most/exactly ... characters ` +
      `(a number, or as many characters as the value of ...), ... otherwise ...", ` +
      `"if the value of ... is/is not/contains/starts with/ends with ... (text or the value of ...), ... otherwise ...", ` +
      `"if the selected label of ... is/is not ... (a dropdown, comparing text or the selected label of another dropdown), ... otherwise ...", ` +
      `"if ... is/is not checked, ... otherwise ...", ` +
      `"if ... is/is not checked the same as ... (another checkbox or radio button), ... otherwise ...", ` +
      `"if ... is/is not disabled, ... otherwise ..." for a button, input, text box, dropdown, or field group, ` +
      `or "repeat ... times, ..." (a number, or the value of ...).`);
    return undefined;
  }
  /** Which element tags have a live, readable ".value" in the DOM. */
  function hasReadableValue(tag: string): boolean {
    return tag === "input" || tag === "textarea" || tag === "select";
  }
  /** A checkbox or radio button has a live, readable/writable ".checked" state. */
  function hasCheckedState(node: PageElement): boolean {
    return node.tag === "input" && (node.attributes.type === "checkbox" || node.attributes.type === "radio");
  }
  /** Which element tags have a live ".disabled" property the browser actually honors. */
  function hasDisabledSupport(tag: string): boolean {
    return tag === "button" || tag === "input" || tag === "textarea" || tag === "select" ||
      tag === "optgroup" || tag === "fieldset";
  }
  // Shared by fetchText, listRecords and createRecord: a relative path starting with a
  // single "/" (never "//", a protocol-relative URL that could reach a different origin,
  // and never a scheme like "https:", which can't appear here anyway since a leading "/"
  // already rules out "scheme:" syntax).
  function isSameOriginPath(path: string): boolean {
    return path.startsWith("/") && !path.startsWith("//");
  }
  /** A plain field/column name: letters, digits and underscores only, never starting with a digit. */
  function isPlainFieldName(name: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  }
  /** Splits "name, email and score" into ["name", "email", "score"]. */
  function splitFieldNames(text: string): string[] {
    return text.split(/\s*,\s*and\s+|\s*,\s*|\s+and\s+/i).map((entry) => entry.trim()).filter(Boolean);
  }
  // Splits "name set to the value of a, email set to the value of b" into its own
  // per-field pairs -- the lookahead only splits at a "," or "and" that is actually
  // followed by another "<field> set to the value of ..." pair, so an element name that
  // happens to contain the word "and" (e.g. "name and address input") is never split apart.
  function splitFieldValuePairs(text: string): string[] {
    const boundary = "(?=[a-zA-Z_][a-zA-Z0-9_]*\\s+set\\s+to\\s+the\\s+value\\s+of\\s)";
    return text.split(new RegExp(`\\s*,\\s*and\\s+${boundary}|\\s*,\\s*${boundary}|\\s+and\\s+${boundary}`, "i"))
      .map((entry) => entry.trim()).filter(Boolean);
  }
  function dequoteRuntime(text: string): string {
    return /^"([\s\S]*)"$/.exec(text.trim())?.[1] ?? text.trim();
  }
  function setStyle(node: PageElement, property: string, value: string, index: number) {
    const capability = webStyles.find((entry) => entry.name === property);
    if (!capability || capability.status !== "available") {
      report(index, `${englishName(property)} is not available.`, capability?.reason ?? "Search the capability catalogue for a supported style.");
      return;
    }
    const checked = cssValue(property, value);
    if ("error" in checked) {
      report(index, checked.error, `Use Set the ${englishName(property)} of ${node.name} to a valid value.`);
    } else if (claim(node, `style ${property}`, index)) {
      node.styles[property] = checked.value;
    }
  }
  function setAttribute(node: PageElement, attribute: AttributeCapability, value: string, index: number) {
    if (attribute.status !== "available") {
      report(index, `${attribute.words[0]} is not available.`, attribute.reason!);
      return;
    }
    if (!claim(node, `attribute ${attribute.name}`, index)) return;
    if (attribute.boolean || attribute.name === "hidden" && /^(?:yes|no|true|false|on|off|enabled|disabled)$/i.test(value)) {
      const enabled = /^(?:yes|true|on|enabled)$/i.test(value);
      if (!enabled && !/^(?:no|false|off|disabled)$/i.test(value)) {
        report(index, `${attribute.words[0]} needs yes or no.`, `Try Set the ${attribute.words[0]} of ${node.name} to yes.`);
      } else if (enabled) node.attributes[attribute.name] = "";
      else delete node.attributes[attribute.name];
      return;
    }
    if (referenceAttributes.has(attribute.name)) {
      references.push({ node, attribute: attribute.name, value, line: index });
      return;
    }
    if (attribute.name === "href" && names.has(targetKey(value))) {
      node.attributes.href = `#${names.get(targetKey(value))!.id}`;
      return;
    }
    if (urlAttributes.has(attribute.name) && !validUrl(value, attribute.name === "src" && node.tag === "img")) {
      report(index, `Invalid ${attribute.words[0]} URL.`, "Use HTTPS, a relative path, or an existing element name for a link destination.");
      return;
    }
    // Autocomplete, role and other token lists are not closed enumerations.
    const closedSets = new Set(["type", "dir", "draggable", "contenteditable", "spellcheck", "translate", "loading", "decoding", "preload", "wrap", "scope", "popovertargetaction"]);
    if (attribute.values?.length && closedSets.has(attribute.name) && !attribute.values.includes(value.toLowerCase())) {
      report(index, `Invalid value for ${attribute.words[0]}.`, `Choose ${attribute.values.join(", ")}.`);
      return;
    }
    node.attributes[attribute.name] = value;
  }
  function applyModifiers(node: PageElement, modifiers: string, index: number) {
    const statement = parseVisualStatement(`Make the text ${modifiers}`);
    const checked = compileVisualSource(`Show Style\nMake the text ${modifiers}`);
    if (!checked.ok || statement?.kind !== "style") {
      if (!checked.ok) {
        for (const diagnostic of checked.diagnostics.filter((item) => item.line === 2)) {
          report(index, diagnostic.message.replaceAll("the text", node.name),
            `${diagnostic.hint} Other properties use Set the property of ${node.name} to a value.`,
            diagnostic.suggestions?.map((suggestion) => ({
              ...suggestion, replacement: suggestion.replacement.replace(/the text/i, node.name)
            })), diagnostic.category);
        }
      }
      return;
    }
    for (const modifier of statement.modifiers) {
      const pixels = /^(\d+) pixels$/.exec(modifier);
      if (Object.hasOwn(colors, modifier)) setStyle(node, "color", colors[modifier]!, index);
      else if (Object.hasOwn(sizes, modifier)) setStyle(node, "font-size", `${sizes[modifier]}px`, index);
      else if (pixels) setStyle(node, "font-size", `${pixels[1]}px`, index);
      else if (Object.hasOwn(weights, modifier)) setStyle(node, "font-weight", String(weights[modifier]), index);
      else if (Object.hasOwn(slants, modifier)) setStyle(node, "font-style", slants[modifier]!, index);
      else if (Object.hasOwn(underlines, modifier)) setStyle(node, "text-decoration-line", underlines[modifier] ? "underline" : "none", index);
    }
  }
  function addElement(capability: ElementCapability, name: string, parent: PageElement, index: number, preset?: string) {
    const key = normalKey(name);
    if (!/^[\p{L}][\p{L}\p{N} _-]{0,79}$/u.test(key) || /^(?:the|a|an)\s/.test(key) ||
        /\b(?:called|named|inside|of|to)\b/.test(key) || ["it", "background"].includes(key)) {
      report(index, `The name "${name}" cannot be used as an unambiguous reference.`,
        "Use a short name such as welcome or sign up. Names cannot contain instruction words such as inside, of, or to.");
      return;
    }
    if (names.has(key)) {
      report(index, `An element called ${name} already exists.`, "Give each element a unique name.");
      return;
    }
    if (elements.length > 200) {
      report(index, "A page can contain at most 200 elements.", "Split this page into smaller documents.");
      return;
    }
    const node: PageElement = {
      name: key, id: `element-${elements.length}`, tag: capability.name, parent: parent.id, text: "",
      attributes: preset ? { type: preset } : capability.name === "button" ? { type: "button" } : {},
      styles: {}, line: index + 1
    };
    // A real radio button's whole point is mutual exclusivity: picking one should un-pick every
    // other radio button in the same group. The browser only enforces that natively when radio
    // inputs share an HTML "name" attribute -- without one, every radio button here would behave
    // like an independent checkbox instead, silently defeating the reason to use a radio button
    // at all. Sharing the immediate parent is IntentLang's only existing notion of grouping (the
    // same mechanism "For each" and every other container-based feature already relies on), so
    // radio buttons under the same parent are auto-grouped by that parent's id, with no new
    // syntax required; radio buttons under different parents are naturally separate groups.
    if (preset === "radio") node.attributes.name = `${parent.id}-radio-group`;
    elements.push(node);
    names.set(key, node);
  }

  if (source.length > 20_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(source)) {
    report(0, "Source must be at most 20000 characters and contain no unsupported control characters.", "Use ordinary text and one instruction per line.");
    return { ok: false, diagnostics };
  }
  for (const [index, original] of lines.entries()) {
    const line = original.trim();
    if (!line || line.startsWith("#")) continue;
    // A trigger sentence ("When ... is clicked/changes, ..." or "When the page loads, ...")
    // already splits and chains its own body on "and then" inside compileClickBody, so it must
    // never be split again here -- doing so would sever a click's own instructions mid-sentence
    // and leave only the first one attached to the trigger. Every other statement kind (add,
    // set, put, underline, show, make) has no "and then" chaining of its own, so splitting the
    // whole line into several statements here is what lets one line both add an element and set
    // its text/parent, e.g. a "For each" loop line that both creates and fills in one go.
    const parts = /^when\s+/i.test(line) ? [line] :
      line.split(/\s+and\s+then\s+/i).map((part) => part.trim()).filter(Boolean);
    for (const part of parts) {
    const statement = parsePageStatement(part);
    if (!statement) {
      report(index, "This sentence is not part of the page language.",
        "Use Add a paragraph called greeting, Set the text of greeting to Hello world, or Set the color of greeting to blue. Single-text movement still works in programs without Add instructions.");
      continue;
    }
    if (statement.kind === "add") {
      const words = englishName(statement.element);
      const preset = Object.hasOwn(inputPresets, words) ? inputPresets[words] : undefined;
      const capability = webElements.find((entry) => preset ? entry.name === "input" : entry.words.includes(words));
      if (!capability) {
        const matches = webElements.filter((entry) => entry.status === "available" &&
          entry.words.some((word) => oneEditAway(word, words))).slice(0, 6);
        report(index, `Unknown element type "${statement.element}".`, "Search the capability catalogue for available element types.",
          matches.map((entry) => ({ label: `Use ${entry.words[0]}`, replacement:
            `Add a ${entry.words[0]} called ${statement.name}${statement.parent ? ` inside ${statement.parent}` : ""}` })),
          matches.length ? "typo" : "syntax");
        continue;
      }
      if (capability.status !== "available") {
        report(index, `${statement.element} is ${capability.status}.`, capability.reason!);
        continue;
      }
      const parent = statement.parent ? resolve(statement.parent, index) : root;
      if (parent) addElement(capability, statement.name, parent, index, preset);
      continue;
    }
    if (statement.kind === "show") {
      const checked = compileVisualSource(statement.source);
      if (!checked.ok) {
        for (const diagnostic of checked.diagnostics) report(index, diagnostic.message, diagnostic.hint, diagnostic.suggestions, diagnostic.category);
      } else {
        addElement(webElements.find((entry) => entry.name === "p")!, "text", root, index);
        const text = names.get("text");
        if (text && claim(text, "text", index)) {
          text.text = checked.ir.text;
          text.styles = { color: checked.ir.textColor, "font-size": `${checked.ir.fontSize}px`, "white-space": "pre-wrap" };
        }
      }
      continue;
    }
    if (statement.kind === "when") {
      const target = resolve(statement.target, index);
      if (!target) continue;
      if (target.tag !== "button") {
        report(index, `Only a button can be clicked, and ${target.name} is a ${englishName(target.tag)}.`,
          `Add a button called ${target.name} instead, such as Add a button called ${target.name}.`);
        continue;
      }
      const snippet = compileClickBody(statement.body, index);
      if (snippet) runtimeScripts.push(`document.getElementById(${JSON.stringify(target.id)}).addEventListener("click",function(){${snippet}});`);
      continue;
    }
    if (statement.kind === "onload") {
      // Reuses the exact same closed instruction set and compiler as a click handler --
      // "the page loads" is just a different trigger, not a different set of actions.
      const snippet = compileClickBody(statement.body, index);
      if (snippet) onloadScripts.push(snippet);
      continue;
    }
    if (statement.kind === "onchange") {
      const target = resolve(statement.target, index);
      if (!target) continue;
      if (!hasReadableValue(target.tag)) {
        report(index, `Only an input, a text box, or a dropdown can change, and ${target.name} is a ${englishName(target.tag)}.`,
          `Add a text input called ${target.name} instead, such as Add a text input called ${target.name}.`);
        continue;
      }
      const snippet = compileClickBody(statement.body, index);
      if (snippet) runtimeScripts.push(`document.getElementById(${JSON.stringify(target.id)}).addEventListener("change",function(){${snippet}});`);
      continue;
    }
    if (statement.kind === "onenter") {
      const target = resolve(statement.target, index);
      if (!target) continue;
      if (!hasReadableValue(target.tag)) {
        report(index, `Only an input, a text box, or a dropdown can receive a key press, and ${target.name} is a ${englishName(target.tag)}.`,
          `Add a text input called ${target.name} instead, such as Add a text input called ${target.name}.`);
        continue;
      }
      // Reuses the exact same closed instruction set and compiler as a click handler --
      // "Enter is pressed in ..." is just a different trigger, not a different set of
      // actions. preventDefault stops the browser's own default Enter behavior for a text
      // field inside an (absent, here) form from submitting anywhere.
      const snippet = compileClickBody(statement.body, index);
      if (snippet) runtimeScripts.push(`document.getElementById(${JSON.stringify(target.id)}).addEventListener("keydown",function(event){if(event.key==="Enter"){event.preventDefault();${snippet}}});`);
      continue;
    }
    if (statement.kind === "make") {
      const phrase = targetKey(statement.phrase);
      const candidates = [...elements.map((node) => node.name), "it", "background"]
        .filter((name) => phrase.startsWith(name + " ")).sort((a, b) => b.length - a.length);
      const name = candidates[0];
      if (!name) {
        report(index, "The style instruction does not name an existing element.", "Use Make followed by an element name and styles, such as Make greeting large and bold.");
        continue;
      }
      const modifiers = phrase.slice(name.length + 1);
      if (name === "background") {
        setStyle(root, "background-color", Object.hasOwn(colors, modifiers) ? colors[modifiers]! : modifiers, index);
      } else {
        const node = resolve(name, index);
        if (node) applyModifiers(node, modifiers, index);
      }
      continue;
    }
    const node = resolve(statement.target, index);
    if (!node) continue;
    if (statement.kind === "underline") {
      setStyle(node, "text-decoration-line", "underline", index);
    } else if (statement.kind === "put") {
      const parent = resolve(statement.parent, index);
      if (!parent) continue;
      let ancestor: PageElement | undefined = parent;
      while (ancestor && ancestor !== node) ancestor = elements.find((entry) => entry.id === ancestor!.parent);
      if (node === root || ancestor === node) {
        report(index, "An element cannot contain itself or one of its ancestors.", "Choose a different parent.");
      } else if (claim(node, "parent", index)) node.parent = parent.id;
    } else {
      const property = englishName(statement.property);
      if (!statement.scope && property === "text") {
        if (node === root || webElements.find((entry) => entry.name === node.tag)?.void) {
          report(index, `${node.name} cannot contain display text.`, "Add a paragraph or set a control's value or an image's alternative text.");
        } else if (claim(node, "text", index)) node.text = statement.value;
        continue;
      }
      const attribute = statement.scope === "style" ? undefined :
        attributesFor(node.tag).find((entry) => entry.words.includes(property));
      const style = statement.scope === "attribute" ? undefined :
        webStyles.find((entry) => entry.words.includes(property));
      if (attribute && style) {
        report(index, `${property} can mean an HTML attribute or a CSS style.`,
          "Choose whether to set the element attribute or its visual styling.",
          ["attribute", "style"].map((scope) => ({
            label: `Set ${scope} ${property}`, replacement: `Set the ${scope} ${property} of ${node.name} to ${statement.value}`
          })), "ambiguity");
      } else if (attribute) setAttribute(node, attribute, statement.value, index);
      else if (style) setStyle(node, style.name, statement.value, index);
      else {
        const candidates: { capability: WebCapability; scope: string }[] = [
          ...(statement.scope !== "style" ? attributesFor(node.tag).map((capability) => ({ capability, scope: "attribute" })) : []),
          ...(statement.scope !== "attribute" ? webStyles.map((capability) => ({ capability, scope: "style" })) : [])
        ].filter(({ capability }) => capability.status === "available" && capability.words.some((word) => oneEditAway(word, property))).slice(0, 6);
        report(index, `Unknown property "${statement.property}" for ${node.name}.`, "Search the catalogue for attributes and styles.",
          candidates.map(({ capability, scope }) => ({ label: `Use ${capability.words[0]}`,
            replacement: `Set the ${scope} ${capability.words[0]} of ${node.name} to ${statement.value}` })),
          candidates.length ? "typo" : "syntax");
      }
    }
    }
  }

  for (const reference of references) {
    const resolved = reference.value.split(",").map((name) => names.get(targetKey(name)));
    const single = ["list", "form", "popovertarget", "aria-activedescendant"].includes(reference.attribute) ||
      reference.attribute === "for" && reference.node.tag === "label";
    if (resolved.some((node) => !node) || single && resolved.length !== 1) {
      report(reference.line, `The ${englishName(reference.attribute)} reference does not identify ${single ? "one existing element" : "existing elements"}.`,
        "Use element names, separated by commas only when the attribute accepts several targets.");
    } else {
      const targets = resolved.filter((node): node is PageElement => node !== undefined);
      const expected = reference.attribute === "list" ? ["datalist"] : reference.attribute === "form" ? ["form"] :
        reference.attribute === "for" && reference.node.tag === "label" ? ["input", "button", "select", "textarea", "meter", "output", "progress"] : undefined;
      if (expected && targets.some((target) => !expected.includes(target.tag))) {
        report(reference.line, `Invalid target for ${englishName(reference.attribute)}.`, `Use an element of type ${expected.join(", ")}.`);
      } else reference.node.attributes[reference.attribute] = targets.map((node) => node.id).join(" ");
    }
  }
  for (const node of elements.slice(1)) {
    const parent = elements.find((entry) => entry.id === node.parent)!;
    const required = requiredParents[node.tag];
    const parentCapability = webElements.find((entry) => entry.name === parent.tag);
    if (parentCapability?.void || textOnly.has(parent.tag) ||
        required && !required.includes(parent.tag) ||
        allowedChildren[parent.tag] && !allowedChildren[parent.tag]!.includes(node.tag)) {
      report(node.line - 1, `${node.name} (${node.tag}) cannot be inside ${parent.name} (${parent.tag}).`,
        required ? `Put it inside ${required.join(", ")}.` : "Choose a container that accepts this element.");
    }
    if (textForbidden.has(node.tag) && node.text) {
      report(node.line - 1, `${node.name} needs child elements rather than direct text.`, "Add the appropriate list items, table cells, options, or image.");
    }
    let depth = 0;
    let ancestor: PageElement | undefined = node;
    while (ancestor && depth <= 32) {
      depth++;
      ancestor = elements.find((entry) => entry.id === ancestor!.parent);
    }
    if (depth > 32) report(node.line - 1, "Element nesting exceeds 32 levels.", "Use a shallower document structure.");
  }
  for (const parent of elements) {
    const children = elements.filter((node) => node.parent === parent.id);
    for (const tag of ["summary", "legend", "caption"]) {
      const special = children.filter((node) => node.tag === tag);
      if (special.length > 1 || special.length === 1 && children[0] !== special[0]) {
        report(special[0]!.line - 1, `${tag} must occur once, as the first child.`, "Move that declaration before the other children and remove duplicates.");
      }
    }
  }
  if (elements.length === 1) report(0, "A page needs at least one element.", "Try Add a paragraph called greeting.");
  if (diagnostics.length) return { ok: false, diagnostics };
  const ir: PageProgram = { kind: "page", elements };
  const body = renderChildren(ir, root.id);
  const parsed = parseFragment(body);
  const found = new Set<string>();
  function checkTree(node: DefaultTreeAdapterTypes.ChildNode, parentId: string) {
    if (!("tagName" in node)) return;
    const id = node.attrs.find((attribute) => attribute.name === "id")?.value;
    if (id) {
      const expected = elements.find((entry) => entry.id === id);
      if (!expected || found.has(id) || expected.parent !== parentId || expected.tag !== node.tagName) {
        report((expected?.line ?? 1) - 1, "The browser would rearrange this invalid HTML structure.", "Change the nesting so the browser preserves the requested elements.");
      }
      found.add(id);
    }
    for (const child of node.childNodes) checkTree(child, id ?? parentId);
  }
  for (const node of parsed.childNodes) checkTree(node, root.id);
  for (const node of elements.slice(1)) {
    if (!found.has(node.id)) report(node.line - 1, `The browser would discard ${node.name} in this position.`, "Choose a valid parent.");
  }
  if (diagnostics.length) return { ok: false, diagnostics };
  const script = (onloadScripts.length || runtimeScripts.length) ?
    `"use strict";${onloadScripts.join("")}${runtimeScripts.join("")}` : undefined;
  return { ok: true, ir, html: renderPage(ir, body, script, usesFetch) };
}

function renderAttributes(node: PageElement): string {
  return ` id="${node.id}"` + Object.entries(node.attributes).map(([key, value]) => ` ${key}="${escapeHtml(value)}"`).join("");
}
function renderChildren(ir: PageProgram, parent: string): string {
  return ir.elements.filter((node) => node.parent === parent).map((node) => {
    const start = `<${node.tag}${renderAttributes(node)}>`;
    if (webElements.find((entry) => entry.name === node.tag)?.void) return start;
    const text = node.text.startsWith("\n") && ["pre", "textarea"].includes(node.tag) ? "\n" + node.text : node.text;
    return `${start}${escapeHtml(text)}${renderChildren(ir, node.id)}</${node.tag}>`;
  }).join("");
}
function renderPage(ir: PageProgram, body: string, script?: string, usesFetch = false): string {
  const css = `*{box-sizing:border-box}body{margin:24px;font-family:system-ui,sans-serif;overflow-wrap:anywhere}
img,video{max-width:100%;height:auto}input,select,textarea,button{font:inherit;max-width:100%}
${ir.elements.filter((node) => Object.keys(node.styles).length).map((node) =>
    `#${node.id}{${Object.entries(node.styles).map(([property, value]) => `${property}:${value}`).join(";")}}`).join("\n")}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}`;
  const hash = createHash("sha256").update(css).digest("base64");
  // A page stays entirely script-free unless it actually uses a "When ... is clicked" sentence.
  // When it does, the ONE script the compiler itself generated (never user-authored markup or
  // text) is hash-pinned into the CSP, so nothing else can ever execute.
  const scriptTag = script ? `<script>${script}</script>` : "";
  const scriptSrc = script ? ` script-src 'sha256-${createHash("sha256").update(script).digest("base64")}';` : "";
  // "default-src 'none'" already blocks every network request a page could otherwise make,
  // including fetch -- this is the ONE narrow exception, and only for pages that actually
  // compiled a "fetch the text at ..." action (see fetchText above, which already validated
  // every such address as same-origin-relative at compile time). Every other page keeps the
  // original zero-network-access posture unchanged.
  const connectSrc = usesFetch ? " connect-src 'self';" : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'sha256-${hash}';${scriptSrc}${connectSrc} img-src 'self' https: data:; media-src 'self' https:; font-src 'self' https:; base-uri 'none'; form-action 'none'">
<title>IntentLang page</title><style>${css}</style></head><body${renderAttributes(ir.elements[0]!)}>${body}${scriptTag}</body></html>
`;
}

