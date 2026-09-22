import { createRequire } from "node:module";
import { lexer } from "css-tree";

interface AttributeData {
  name: string;
  valueSet?: string;
}
interface TagData {
  name: string;
  void?: boolean;
  attributes: AttributeData[];
}
interface HtmlData {
  tags: TagData[];
  globalAttributes: AttributeData[];
  valueSets: { name: string; values: { name: string }[] }[];
}
interface CssData {
  properties: { name: string; syntax?: string; status?: string }[];
}
const require = createRequire(import.meta.url);
const htmlData: HtmlData = require("@vscode/web-custom-data/data/browsers.html-data.json");
const cssData: CssData = require("@vscode/web-custom-data/data/browsers.css-data.json");

export type CapabilityStatus = "available" | "managed" | "restricted";
export interface WebCapability {
  name: string;
  words: string[];
  status: CapabilityStatus;
  reason?: string;
}
export interface ElementCapability extends WebCapability {
  void: boolean;
  parents?: string[];
}
export interface AttributeCapability extends WebCapability {
  boolean: boolean;
  values?: string[];
}

const elementWords: Record<string, string[]> = {
  a: ["link"], link: ["resource link"], p: ["paragraph"], div: ["container"], span: ["inline text"],
  h1: ["heading", "heading level one"], h2: ["subheading", "heading level two"],
  h3: ["heading level three"], h4: ["heading level four"],
  h5: ["heading level five"], h6: ["heading level six"],
  img: ["image"], ul: ["bullet list", "unordered list"], ol: ["numbered list", "ordered list"],
  li: ["list item"], dl: ["description list"], dt: ["term"], dd: ["description"],
  hr: ["divider"], br: ["line break"], wbr: ["optional line break"],
  pre: ["preformatted text"], blockquote: ["quotation"], q: ["inline quotation"],
  strong: ["important text"], em: ["emphasized text"], b: ["bold text"],
  i: ["italic text"], u: ["underlined text"], s: ["struck out text"],
  abbr: ["abbreviation"], dfn: ["definition"], sub: ["subscript"], sup: ["superscript"],
  kbd: ["keyboard input"], samp: ["sample output"], var: ["variable"],
  mark: ["highlighted text"], ins: ["inserted text"], del: ["deleted text"],
  bdi: ["isolated text"], bdo: ["direction override"],
  figcaption: ["figure caption"], colgroup: ["table column group"], col: ["table column"],
  thead: ["table header"], tbody: ["table body"], tfoot: ["table footer"],
  tr: ["table row"], td: ["table cell"], th: ["header cell"], caption: ["table caption"],
  fieldset: ["field group"], legend: ["field group title"], input: ["input"],
  textarea: ["text area"], select: ["dropdown"], datalist: ["suggestion list"],
  optgroup: ["option group"], progress: ["progress bar"], details: ["expandable section"],
  summary: ["summary"], nav: ["navigation"], aside: ["sidebar"], hgroup: ["heading group"],
  rt: ["ruby text"], rp: ["ruby fallback"], rb: ["ruby base"]
};

const elementRestrictions: Record<string, string> = {
  script: "User-supplied scripts and custom event handlers are not supported.",
  style: "Use English styling instructions, not an embedded stylesheet.",
  iframe: "Embedded browsing contexts need a separate permissions model.",
  fencedframe: "Embedded browsing contexts need a separate permissions model.",
  object: "Embedded executable documents are not supported.",
  embed: "Embedded executable documents are not supported.",
  template: "Template instantiation and shadow DOM are not implemented.",
  slot: "Shadow DOM is not implemented.",
  canvas: "Canvas drawing needs drawing commands, not just an empty HTML element.",
  noscript: "Generated pages contain no scripts; use ordinary page content.",
  param: "This obsolete element is not supported.",
  rb: "This obsolete element is not supported.",
  selectedcontent: "Customizable select content is not implemented."
};
const managed = new Set(["html", "head", "body", "title", "base", "meta", "link"]);

export const requiredParents: Readonly<Record<string, string[]>> = {
  li: ["ul", "ol", "menu"], dt: ["dl"], dd: ["dl"],
  caption: ["table"], colgroup: ["table"], col: ["colgroup"],
  thead: ["table"], tbody: ["table"], tfoot: ["table"],
  tr: ["tbody", "thead", "tfoot", "table"], td: ["tr"], th: ["tr"],
  option: ["select", "datalist", "optgroup"], optgroup: ["select"],
  summary: ["details"], legend: ["fieldset"], figcaption: ["figure"],
  source: ["picture", "video", "audio"], track: ["video", "audio"],
  area: ["map"], rt: ["ruby"], rp: ["ruby"]
};

export function englishName(value: string): string {
  return value.toLowerCase().replaceAll("-", " ").replace(/\s+/g, " ").trim();
}

export const webElements: ElementCapability[] = htmlData.tags.map((tag) => ({
  name: tag.name,
  words: [...new Set([...(elementWords[tag.name] ?? []), ...(tag.name === "link" ? [] : [englishName(tag.name)])])],
  void: tag.void === true,
  status: managed.has(tag.name) ? "managed" : elementRestrictions[tag.name] ? "restricted" : "available",
  ...(managed.has(tag.name) ? { reason: "The compiler owns the document shell. Use page as the root." } :
    elementRestrictions[tag.name] ? { reason: elementRestrictions[tag.name] } : {}),
  ...(requiredParents[tag.name] ? { parents: requiredParents[tag.name] } : {})
}));

export const inputPresets: Readonly<Record<string, string>> = {
  "text input": "text", "email input": "email", "password input": "password",
  "number input": "number", "date input": "date", "color picker": "color",
  checkbox: "checkbox", "radio button": "radio", slider: "range", "file picker": "file"
};

const attributeWords: Record<string, string[]> = {
  href: ["destination"], src: ["source"], alt: ["alternative text"],
  for: ["linked control"], readonly: ["read only"], tabindex: ["tab order"],
  maxlength: ["maximum length"], minlength: ["minimum length"],
  colspan: ["column span"], rowspan: ["row span"], datetime: ["date and time"],
  popovertarget: ["popover target"], popovertargetaction: ["popover action"],
  "aria-label": ["accessible name"], "aria-labelledby": ["labelled by"],
  "aria-describedby": ["described by"], "aria-controls": ["controlled elements"]
};
const attributeRestrictions: Record<string, string> = {
  style: "Set individual style properties using English.",
  id: "Element IDs are generated from names; refer to elements by name.",
  nonce: "The compiler manages the content security policy.",
  is: "Custom elements need a script runtime, which is not implemented.",
  action: "Form submission and backend connections are not implemented.",
  formaction: "Form submission and backend connections are not implemented.",
  srcdoc: "Embedded documents are not supported.",
  srcset: "Responsive image source lists are not implemented; use source.",
  imagesrcset: "Responsive image source lists are not implemented.",
  ping: "Link tracking requests are not supported.",
  autoplay: "Automatic media playback requires an explicit interaction policy.",
  contextmenu: "This obsolete attribute is not supported.",
  dropzone: "This obsolete attribute is not supported."
};

export function attributesFor(tag: string): AttributeCapability[] {
  const attributes = new Map(htmlData.globalAttributes.map((attribute) => [attribute.name, attribute]));
  for (const attribute of htmlData.tags.find((entry) => entry.name === tag)?.attributes ?? []) {
    attributes.set(attribute.name, attribute);
  }
  return [...attributes.values()].map((attribute) => {
    const reason = attribute.name.startsWith("on") ? "Custom event handlers are not implemented." :
      attributeRestrictions[attribute.name];
    const values = htmlData.valueSets.find((set) => set.name === attribute.valueSet)?.values.map((value) => value.name);
    return {
      name: attribute.name,
      words: [...new Set([...(attributeWords[attribute.name] ?? []), englishName(attribute.name)])],
      status: reason ? "restricted" : "available",
      ...(reason ? { reason } : {}),
      boolean: attribute.valueSet === "v",
      ...(values ? { values } : {})
    };
  });
}

export const webStyles: WebCapability[] = cssData.properties.map((property) => {
  const reason = property.name.startsWith("-") ? "Vendor-specific properties are not portable." :
    !lexer.getProperty(property.name) ? "This property's value grammar is not covered by the pinned CSS validator." :
    property.name.startsWith("animation") ? "Named multi-element animations and keyframes are not implemented. Single-text movement remains available." :
    property.status === "obsolete" || property.status === "nonstandard" ? "This property is obsolete or nonstandard." : undefined;
  return { name: property.name, words: [englishName(property.name)],
    status: reason ? "restricted" : "available", ...(reason ? { reason } : {}) };
});

export function elementExample(element: ElementCapability): string {
  const ancestors: ElementCapability[] = [];
  let current = element;
  while (current.parents?.[0]) {
    const parent = webElements.find((candidate) => candidate.name === current.parents![0])!;
    ancestors.unshift(parent);
    current = parent;
  }
  return [...ancestors, element].map((entry, index, entries) =>
    `Add a ${entry.words[0]} called sample ${entry.name}${index ? ` inside sample ${entries[index - 1]!.name}` : ""}`
  ).join("\n");
}

export function getWebCatalogue() {
  return {
    source: "@vscode/web-custom-data 0.6.3 (HTML specification and MDN data)",
    elements: webElements.map((element) => ({
      ...element, example: element.status === "available" ? elementExample(element) : undefined,
      attributes: attributesFor(element.name)
    })),
    inputPresets,
    styles: webStyles,
    limitations: [
      "This is a document-and-style foundation, not complete HTML, CSS, or JavaScript coverage.",
      "Native details, inputs, selects, media controls and popovers use browser behavior.",
      "Custom scripts, event handlers, form submission, embedded documents, SVG, MathML and backend services are not implemented.",
      "CSS values are validated; English aliases cover property names, common units and selected values, not every possible CSS expression.",
      "External images, media and fonts require explicit HTTPS URLs and a network connection."
    ]
  };
}
