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
  // Maps a plain-English comparison word to its JS operator; only these five are recognized,
  // so a runtime "if" can never compile to an arbitrary/unsafe comparison.
  const clickComparisons: Record<string, string> = {
    "greater than": ">", "less than": "<", "at least": ">=", "at most": "<=", "equal to": "==="
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
    const ifValue = /^if\s+the\s+value\s+of\s+(.+?)\s+is\s+(greater than|less than|at least|at most|equal to)\s+(?:the\s+value\s+of\s+(.+?)|(-?\d+(?:\.\d+)?))\s*,\s*(.+?)(?:\s+otherwise\s+(.+))?$/i.exec(part);
    // A fixed-range check, inclusive of both ends -- both ends are plain numbers known at
    // compile time (not a live input's value, so a range can never be inverted or moved by
    // user input), and checked before ifText below so "is between 1 and 10" is never
    // misread as a literal-text comparison against the whole phrase "between 1 and 10".
    const ifBetween = !ifValue ?
      /^if\s+the\s+value\s+of\s+(.+?)\s+is\s+between\s+(-?\d+(?:\.\d+)?)\s+and\s+(-?\d+(?:\.\d+)?)\s*,\s*(.+?)(?:\s+otherwise\s+(.+))?$/i.exec(part) : null;
    // A live text's own length, for validation like a minimum/maximum password or username
    // length -- distinct from the value comparisons above, which compare the text/number
    // itself, not how long it is. Checked before ifText below for the same shadowing reason
    // as ifBetween: "has more than 5 characters" must never be misread as literal text.
    const ifLength = !ifValue && !ifBetween ?
      /^if\s+the\s+value\s+of\s+(.+?)\s+has\s+(more than|fewer than|at least|at most|exactly)\s+(\d+)\s+characters?\s*,\s*(.+?)(?:\s+otherwise\s+(.+))?$/i.exec(part) : null;
    // Only tried when the numeric form above doesn't match (e.g. "is red" rather than
    // "is greater than 5"), so a numeric comparison is never misread as a text one. "is not"
    // must come before the plain "is" in the alternation, or "is not red" would match "is"
    // with a leftover "not red" as the compared text instead of matching "is not" whole.
    const ifText = !ifValue && !ifBetween && !ifLength ? /^if\s+the\s+value\s+of\s+(.+?)\s+(is not|is|contains|starts with|ends with)\s+(?:the\s+value\s+of\s+(.+?)|(.+?))\s*,\s*(.+?)(?:\s+otherwise\s+(.+))?$/i.exec(part) : null;
    // A checkbox/radio button's state lives in ".checked", not ".value" (its ".value" is a
    // fixed attribute, never reflecting whether it's ticked) -- this is a separate condition
    // form for that reason. The negative lookahead keeps it from ever matching "if the value
    // of X is checked, ..." (which isn't valid there, since "checked" isn't a recognized
    // ifValue/ifText comparison word either, and would otherwise misread "the value of X"
    // itself as the checkbox's name).
    const ifChecked = !ifValue && !ifBetween && !ifLength && !ifText ?
      /^if\s+(?!the\s+value\s+of\s)(.+?)\s+is\s+(checked|not checked)\s*,\s*(.+?)(?:\s+otherwise\s+(.+))?$/i.exec(part) : null;
    // "Repeat" needs no shadowing precaution of its own -- no other pattern starts with the
    // word "repeat" -- but like "if", its own trailing instruction is compiled recursively.
    const repeat = /^repeat\s+(-?\d+)\s+times?\s*,\s*(.+)$/i.exec(part);
    // Checked before the plainer "set the text of X to Y", since that one's own value half
    // would otherwise happily swallow "the value of Y" as literal display text instead.
    const setFromValue = /^set\s+the\s+text\s+of\s+(.+?)\s+to\s+the\s+value\s+of\s+(.+)$/i.exec(part);
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
    const setRandom = /^set\s+the\s+text\s+of\s+(.+?)\s+to\s+a\s+random\s+number\s+from\s+(-?\d+)\s+to\s+(-?\d+)$/i.exec(part);
    const setText = /^set\s+the\s+text\s+of\s+(.+?)\s+to\s+(.+)$/i.exec(part);
    // Checked before the plain "add/subtract <number>" forms below, for the same reason
    // setFromValue is checked before setText: otherwise "the value of X" would be read as a
    // (non-numeric) literal amount instead of a live input value.
    const addFromValue = /^add\s+the\s+value\s+of\s+(.+?)\s+to\s+the\s+text\s+of\s+(.+)$/i.exec(part);
    const subtractFromValue = /^subtract\s+the\s+value\s+of\s+(.+?)\s+from\s+the\s+text\s+of\s+(.+)$/i.exec(part);
    const addText = /^add\s+(-?\d+(?:\.\d+)?)\s+to\s+the\s+text\s+of\s+(.+)$/i.exec(part);
    const subtractText = /^subtract\s+(-?\d+(?:\.\d+)?)\s+from\s+the\s+text\s+of\s+(.+)$/i.exec(part);
    // The multiplicative siblings of add/subtract -- same fixed-number-only shape (no
    // live-input multiplier yet), same clamp-to-a-real-number semantics via Number(...)||0.
    const multiplyText = /^multiply\s+the\s+text\s+of\s+(.+?)\s+by\s+(-?\d+(?:\.\d+)?)$/i.exec(part);
    const divideText = /^divide\s+the\s+text\s+of\s+(.+?)\s+by\s+(-?\d+(?:\.\d+)?)$/i.exec(part);
    // Writes into a live input/textarea/select's own ".value" (as opposed to "set the text
    // of ...", which writes an element's displayed textContent) -- for clearing or presetting
    // a form field from a click, e.g. resetting an input after its value has been used.
    // Checked before the plainer "set the value of X to Y" for the same reason setFromValue
    // is checked before setText: otherwise "the value of Y" would be read as literal text.
    const setValueFromValue = /^set\s+the\s+value\s+of\s+(.+?)\s+to\s+the\s+value\s+of\s+(.+)$/i.exec(part);
    const setValue = !setValueFromValue ? /^set\s+the\s+value\s+of\s+(.+?)\s+to\s+(.+)$/i.exec(part) : null;
    const clearValue = /^clear\s+the\s+value\s+of\s+(.+)$/i.exec(part);
    // Sets a checkbox/radio button's own ".checked" state directly.
    const checkBox = /^check\s+(.+)$/i.exec(part);
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
      const low = Number(ifBetween[2]);
      const high = Number(ifBetween[3]);
      if (low > high) {
        report(index, `The range "between ${ifBetween[2]} and ${ifBetween[3]}" is backwards.`,
          `Put the smaller number first, such as "is between ${ifBetween[3]} and ${ifBetween[2]}".`);
        return undefined;
      }
      const inner = compileClickPart(ifBetween[4]!.trim(), index);
      if (inner === undefined) return undefined;
      let elseClause = "";
      if (ifBetween[5]) {
        const elseInner = compileClickPart(ifBetween[5].trim(), index);
        if (elseInner === undefined) return undefined;
        elseClause = `else{${elseInner}}`;
      }
      const value = `(Number(document.getElementById(${JSON.stringify(source.id)}).value)||0)`;
      return `if(${value}>=${JSON.stringify(low)}&&${value}<=${JSON.stringify(high)}){${inner}}${elseClause}`;
    } else if (ifLength) {
      const source = resolve(ifLength[1]!, index);
      if (!source) return undefined;
      if (!hasReadableValue(source.tag)) {
        report(index, `Only an input, a text box, or a dropdown has a value to read, and ${source.name} is a ${englishName(source.tag)}.`,
          `Add an input called ${source.name} instead, such as Add a text input called ${source.name}.`);
        return undefined;
      }
      const operator = lengthComparisons[ifLength[2]!.toLowerCase()]!;
      const inner = compileClickPart(ifLength[4]!.trim(), index);
      if (inner === undefined) return undefined;
      let elseClause = "";
      if (ifLength[5]) {
        const elseInner = compileClickPart(ifLength[5].trim(), index);
        if (elseInner === undefined) return undefined;
        elseClause = `else{${elseInner}}`;
      }
      return `if(String(document.getElementById(${JSON.stringify(source.id)}).value).length${operator}${JSON.stringify(Number(ifLength[3]))}){${inner}}${elseClause}`;
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
    } else if (repeat) {
      const count = Number(repeat[1]);
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
      const inner = compileClickPart(repeat[2]!.trim(), index);
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
    } else if (setRandom) {
      const target = resolve(setRandom[1]!, index);
      if (!target) return undefined;
      const min = Number(setRandom[2]);
      const max = Number(setRandom[3]);
      if (min > max) {
        report(index, `A random range's low end (${min}) can't be greater than its high end (${max}).`,
          `Try "a random number from ${max} to ${min}" instead.`);
        return undefined;
      }
      return `document.getElementById(${JSON.stringify(target.id)}).textContent=String(Math.floor(Math.random()*(${JSON.stringify(max - min + 1)}))+(${JSON.stringify(min)}));`;
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
    }
    report(index, `"${part}" is not one of the supported click instructions.`,
      `Try "set the text of ... to ...", "set the text of ... to the value of ...", ` +
      `"set the text of ... to the selected label of ... (a dropdown)", ` +
      `"set the text of ... to the number of characters in the value of ...", ` +
      `"set the text of ... to a random number from ... to ...", "add ... to the text of ...", ` +
      `"subtract ... from the text of ...", "multiply the text of ... by ...", ` +
      `"divide the text of ... by ...", "add the value of ... to the text of ...", ` +
      `"subtract the value of ... from the text of ...", "set the value of ... to ...", ` +
      `"set the value of ... to the value of ...", "clear the value of ...", ` +
      `"check ..."/"uncheck ..." for a checkbox or radio button, ` +
      `"toggle whether ... is checked" for a checkbox or radio button, ` +
      `"hide ...", "show ...", "toggle the visibility of ...", "focus ...", ` +
      `"disable ...", "enable ..." for a button, input, text box, dropdown, or field group, ` +
      `"if the value of ... is greater than/less than/` +
      `at least/at most/equal to (a number or the value of ...), ... otherwise ...", ` +
      `"if the value of ... is between ... and ... (two numbers), ... otherwise ...", ` +
      `"if the value of ... has more than/fewer than/at least/at most/exactly ... characters, ... otherwise ...", ` +
      `"if the value of ... is/is not/contains/starts with/ends with ... (text or the value of ...), ... otherwise ...", ` +
      `"if ... is/is not checked, ... otherwise ...", ` +
      `or "repeat ... times, ...".`);
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
  return { ok: true, ir, html: renderPage(ir, body, script) };
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
function renderPage(ir: PageProgram, body: string, script?: string): string {
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
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'sha256-${hash}';${scriptSrc} img-src 'self' https: data:; media-src 'self' https:; font-src 'self' https:; base-uri 'none'; form-action 'none'">
<title>IntentLang page</title><style>${css}</style></head><body${renderAttributes(ir.elements[0]!)}>${body}${scriptTag}</body></html>
`;
}

