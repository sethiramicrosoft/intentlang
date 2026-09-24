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
      // Checked before the plainer "set the text of X to Y", since that one's own value half
      // would otherwise happily swallow "the value of Y" as literal display text instead.
      const setFromValue = /^set\s+the\s+text\s+of\s+(.+?)\s+to\s+the\s+value\s+of\s+(.+)$/i.exec(part);
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
      if (setFromValue) {
        const target = resolve(setFromValue[1]!, index);
        const source = target ? resolve(setFromValue[2]!, index) : undefined;
        if (!target || !source) return undefined;
        if (!hasReadableValue(source.tag)) {
          report(index, `Only an input, a text box, or a dropdown has a value to read, and ${source.name} is a ${englishName(source.tag)}.`,
            `Add an input called ${source.name} instead, such as Add a text input called ${source.name}.`);
          return undefined;
        }
        statements.push(`document.getElementById(${JSON.stringify(target.id)}).textContent=document.getElementById(${JSON.stringify(source.id)}).value;`);
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
        statements.push(`(function(){var e=document.getElementById(${JSON.stringify(target.id)});` +
          `e.textContent=String((Number(e.textContent)||0)+(${sign}(Number(document.getElementById(${JSON.stringify(source.id)}).value)||0)));})();`);
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
        statements.push(`document.getElementById(${JSON.stringify(target.id)}).textContent=String(Math.floor(Math.random()*(${JSON.stringify(max - min + 1)}))+(${JSON.stringify(min)}));`);
      } else if (setText) {
        const target = resolve(setText[1]!, index);
        if (!target) return undefined;
        statements.push(`document.getElementById(${JSON.stringify(target.id)}).textContent=${JSON.stringify(dequoteRuntime(setText[2]!))};`);
      } else if (addText || subtractText) {
        const match = addText ?? subtractText!;
        const target = resolve(match[2]!, index);
        if (!target) return undefined;
        const amount = (addText ? 1 : -1) * Number(match[1]);
        statements.push(`(function(){var e=document.getElementById(${JSON.stringify(target.id)});` +
          `e.textContent=String((Number(e.textContent)||0)+(${JSON.stringify(amount)}));})();`);
      } else {
        report(index, `"${part}" is not one of the supported click instructions.`,
          `Try "set the text of ... to ...", "set the text of ... to the value of ...", ` +
          `"set the text of ... to a random number from ... to ...", "add ... to the text of ...", ` +
          `"subtract ... from the text of ...", "add the value of ... to the text of ...", ` +
          `or "subtract the value of ... from the text of ...".`);
        return undefined;
      }
    }
    return statements.join("");
  }
  /** Which element tags have a live, readable ".value" in the DOM. */
  function hasReadableValue(tag: string): boolean {
    return tag === "input" || tag === "textarea" || tag === "select";
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
    const statement = parsePageStatement(line);
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
  const script = runtimeScripts.length ? `"use strict";${runtimeScripts.join("")}` : undefined;
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

