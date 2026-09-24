import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Script } from "node:vm";
import { compileEnglishSource } from "../src/english.js";
import { compileVisualSource } from "../src/visual.js";
import { compilePageSource } from "../src/web.js";
import { attributesFor, elementExample, getWebCatalogue, webElements, webStyles } from "../src/web-catalogue.js";
import { PAGE_EXAMPLES } from "../src/web-examples.js";
import { VISUAL_JS } from "../src/visual-assets.js";

function page(source: string) {
  const result = compileEnglishSource(source);
  if (!result.ok) assert.fail(JSON.stringify(result.diagnostics, null, 2));
  if (result.ir.kind !== "page") assert.fail("Expected a page document");
  return { ...result, ir: result.ir };
}
function invalid(source: string, pattern?: RegExp) {
  const result = compileEnglishSource(source);
  if (result.ok) assert.fail("Expected no HTML for: " + source);
  assert.equal("html" in result, false);
  if (pattern) assert.match(JSON.stringify(result.diagnostics), pattern);
  return result.diagnostics;
}

test("document grammar composes named elements, text, styles, attributes and nesting", () => {
  const source = `Add a section called welcome
Add a heading called main greeting inside welcome
Set the text of main greeting to Hello, world! "C:\\notes" & <b>English</b>.
Make main greeting large and bold and underlined
Set the background color of welcome to rebeccapurple
Set the padding of welcome to 24 pixels
Add an email input called email
Set the required of email to yes
Put email inside welcome`;
  const result = page(source);
  assert.deepEqual(result, page(source));
  assert.equal(result.ir.elements[2]!.text, 'Hello, world! "C:\\notes" & <b>English</b>.');
  assert.equal(result.ir.elements[2]!.styles["text-decoration-line"], "underline");
  assert.equal(result.ir.elements[1]!.styles.padding, "24px");
  assert.equal(result.ir.elements[3]!.parent, result.ir.elements[1]!.id);
  assert.equal(result.ir.elements[3]!.attributes.required, "");
  assert.match(result.html, /&lt;b&gt;English&lt;\/b&gt;/);
  assert.doesNotMatch(result.html, /<script| style=/);
  const css = /<style>([\s\S]*?)<\/style>/.exec(result.html)![1]!;
  assert.ok(result.html.includes(`sha256-${createHash("sha256").update(css).digest("base64")}`));
  assert.doesNotThrow(() => new Script(VISUAL_JS));
});

test("every available catalogue element compiles through the same document grammar", () => {
  assert.equal(webElements.length, 116, "Review coverage when updating the pinned HTML dataset");
  assert.equal(webElements.filter((entry) => entry.status === "available").length, 96);
  for (const element of webElements) {
    if (element.status === "available") {
      const result = page(elementExample(element));
      assert.equal(result.ir.elements.at(-1)?.tag, element.name, element.name);
      for (const alias of element.words) {
        const source = elementExample(element).replace(`Add a ${element.words[0]} called`, `Add a ${alias} called`);
        assert.equal(page(source).ir.elements.at(-1)?.tag, element.name, alias);
      }
    } else {
      assert.ok(element.reason);
      invalid(`Add a ${element.words[0]} called restricted`, /restricted|managed/);
    }
  }
});

test("every available standard CSS property shares property lookup, validation and rendering", () => {
  assert.equal(webStyles.filter((entry) => entry.status === "available").length, 512);
  for (const style of webStyles) {
    if (style.status === "available") {
      const result = page(`Add a paragraph called example\nSet the style ${style.words[0]} of example to initial`);
      assert.equal(result.ir.elements[1]!.styles[style.name], "initial", style.name);
      assert.ok(result.html.includes(`${style.name}:initial`), style.name);
    } else {
      assert.ok(style.reason, style.name);
    }
  }
});

test("all built-in page examples compile and share the CLI and IDE compiler", async () => {
  for (const example of Object.values(PAGE_EXAMPLES)) page(example);
  const dir = await mkdtemp(join(tmpdir(), "intentlang-page-cli-"));
  try {
    const path = join(dir, "page.intent");
    const output = join(dir, "page.html");
    await writeFile(path, PAGE_EXAMPLES.webpage);
    execFileSync(process.execPath, ["--import", "tsx", "src/cli.ts", "visual", path, "--output", output, "--write"]);
    assert.equal(await readFile(output, "utf8"), page(PAGE_EXAMPLES.webpage).html);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("legacy scenes remain byte-for-byte unchanged and ordinary text is not mistaken for page syntax", () => {
  for (const source of [
    "Show Hello world\nMake the text large and underlined",
    "Show Add a section called welcome\nMove the text from left to right over 3 seconds",
    "Show Set the text of greeting to Hello",
    "Show THINK BUILD MOVE\nPut each word on a new line"
  ]) assert.deepEqual(compileEnglishSource(source), compileVisualSource(source));
  const mixed = page("Show Hello world\nAdd a section called welcome\nPut the text inside welcome");
  assert.equal(mixed.ir.elements[1]!.text, "Hello world");
  assert.equal(mixed.ir.elements[1]!.parent, mixed.ir.elements[2]!.id);
});

test("ambiguous properties and pronouns offer explicit replacements without applying guesses", () => {
  const source = "Add an image called portrait\nSet the width of portrait to 120";
  const [diagnostic] = invalid(source, /attribute or a CSS style/);
  assert.equal(diagnostic?.category, "ambiguity");
  assert.equal(diagnostic?.suggestions?.length, 2);
  const attribute = diagnostic!.suggestions!.find((item) => item.label.includes("attribute"))!;
  assert.equal(page(source.split("\n")[0] + "\n" + attribute.replacement).ir.elements[1]!.attributes.width, "120");
  invalid("Add a paragraph called first\nAdd a paragraph called second\nMake it bold", /more than one element/);
  assert.equal(page("Add a paragraph called greeting\nUnderline it").ir.elements[1]!.styles["text-decoration-line"], "underline");
  const meanings = invalid("Add a paragraph called greeting\nMake greeting normal");
  assert.equal(meanings[0]!.category, "ambiguity");
  for (const suggestion of meanings[0]!.suggestions!) {
    page("Add a paragraph called greeting\n" + suggestion.replacement);
  }
});

test("element, property and modifier spelling suggestions preserve user text", () => {
  for (const source of [
    "Add a paragrap called greeting",
    "Add a paragraph called greeting\nSet the font sze of greeting to 24 pixels",
    "Add a paragraph called greeting\nMake greeting larg and bold"
  ]) {
    const diagnostics = invalid(source);
    const diagnostic = diagnostics.find((entry) => entry.category === "typo")!;
    assert.ok(diagnostic?.suggestions?.length, source);
    const lines = source.split("\n");
    lines[diagnostic.line - 1] = diagnostic.suggestions![0]!.replacement;
    page(lines.join("\n"));
  }
  assert.equal(page("Add a paragraph called greeting\nSet the text of greeting to larg and paragrap.").ir.elements[1]!.text, "larg and paragrap.");
});

test("invalid structures, cycles, duplicates and malformed sentences never return HTML", () => {
  for (const [source, reason] of [
    ["Add a paragraph called greeting\nAdd a paragraph called greeting", /already exists/],
    ["Add a section called welcome\nPut welcome inside welcome", /cannot contain itself/],
    ["Add a section called outer\nAdd a section called inner inside outer\nPut outer inside inner", /ancestors/],
    ["Add a section called outer\nPut page inside outer", /cannot contain/],
    ["Add an image called portrait\nAdd a paragraph called caption inside portrait", /cannot be inside/],
    ["Add a paragraph called outer\nAdd a section called inner inside outer", /rearrange/],
    ["Add a table row called row", /cannot be inside/],
    ["Add a bullet list called list\nSet the text of list to Hello", /child elements/],
    ["Add a section called outer\nAdd a form called first inside outer\nAdd a form called second inside first", /discard/],
    ["Add a paragraph called greeting\nMake greeting bold\nSet the font weight of greeting to 400", /More than one/],
    ["Add a paragraph called greeting\nMake greeting large and huge", /More than one/],
    ["Add a section called outer\nDance outer", /not part of/],
    ["Add a paragraph called greeting\nSet the color of missing to blue", /no earlier element/],
    ["Add a paragraph called greeting\nSet the color of greeting to banana", /Invalid value/],
    ["Add a checkbox called consent\nSet the checked of consent to maybe", /yes or no/],
    ["Add an input called email\nSet the type of email to dragon", /Invalid value/],
    ["Add a label called name label\nSet the linked control of name label to missing", /does not identify/],
    ["Add a paragraph called greeting\nAdd a label called name label\nSet the linked control of name label to greeting", /Invalid target/]
  ] as const) invalid(source, reason);
});

test("attributes remain element-scoped, booleans are not string false and name references become IDs", () => {
  const result = page(`Add a checkbox called consent
Set the checked of consent to no
Set the disabled of consent to no
Set the hidden of consent to no
Add a label called consent label
Set the text of consent label to Agree
Set the linked control of consent label to consent
Set the accessible name of consent to Consent
Add a paragraph called explanation
Set the described by of consent to explanation`);
  assert.equal("checked" in result.ir.elements[1]!.attributes, false);
  assert.equal("disabled" in result.ir.elements[1]!.attributes, false);
  assert.equal("hidden" in result.ir.elements[1]!.attributes, false);
  assert.equal(result.ir.elements[2]!.attributes.for, result.ir.elements[1]!.id);
  assert.equal(result.ir.elements[1]!.attributes["aria-describedby"], result.ir.elements[3]!.id);
  invalid("Add a paragraph called text\nSet the checked of text to yes", /Unknown property/);
  const all = getWebCatalogue();
  assert.ok(all.elements.find((entry) => entry.name === "input")!.attributes.some((entry) => entry.name === "checked"));
  assert.ok(!attributesFor("p").some((entry) => entry.name === "checked"));
});

test("executable content, declaration injection and unsupported active capabilities are refused", () => {
  for (const line of [
    "Set the onclick of greeting to alert",
    "Set the attribute style of greeting to color:red",
    "Set the id of greeting to malicious",
    "Set the color of greeting to red;display:none",
    "Set the background image of greeting to url(javascript:alert)",
    "Set the background image of greeting to url(data:text/html,script)"
  ]) invalid("Add a paragraph called greeting\n" + line);
  for (const url of ["javascript:alert(1)", "data:text/html,Hello", "//example.com/image.png", "http://example.com/image.png"]) {
    invalid("Add an image called portrait\nSet the source of portrait to " + url, /Invalid source URL/);
  }
  invalid("Add a form called signup\nSet the action of signup to https://example.com", /not available/);
  const result = page("Add a paragraph called text\nSet the text of text to </style><script>alert(1)</script>");
  assert.doesNotMatch(result.html, /<script>/);
  const content = page('Add a paragraph called text\nSet the content of text to "</style><script>bad</script>"');
  assert.doesNotMatch(content.html, /<script>/);
});

test("a page with no When-clicked sentence stays entirely script-free, byte for byte", () => {
  const result = page("Add a paragraph called greeting\nSet the text of greeting to Hello world");
  assert.doesNotMatch(result.html, /<script>/);
  assert.doesNotMatch(result.html, /script-src/);
});

test("When ... is clicked compiles to a single hash-pinned script, and only when used", () => {
  const result = page(`Add a paragraph called counter
Set the text of counter to 0
Add a button called increment
Set the text of increment to Add one
When the increment is clicked, add 1 to the text of counter`);
  assert.match(result.html, /<script>"use strict";.+<\/script>/);
  assert.match(result.html, /script-src 'sha256-/);
  // The script tag body's own hash must match what's declared in the CSP, so the browser will
  // actually allow it to run instead of silently refusing it.
  const scriptBody = /<script>(.+?)<\/script>/.exec(result.html)![1]!;
  const expectedHash = createHash("sha256").update(scriptBody).digest("base64");
  assert.ok(result.html.includes(`script-src 'sha256-${expectedHash}'`));
  assert.doesNotMatch(result.html, /onclick=/);
  // User-visible text is embedded as a JSON string literal, never as raw executable code.
  assert.match(scriptBody, /getElementById\("element-2"\)\.addEventListener\("click"/);
});

test("When ... is clicked only accepts a button as its target", () => {
  invalid(`Add a paragraph called label
When the label is clicked, set the text of label to clicked`, /Only a button can be clicked/);
});

test("When ... is clicked only accepts its small closed set of runtime instructions", () => {
  invalid(`Add a button called go
When the go is clicked, delete everything`, /not one of the supported click instructions/);
});

test("When ... is clicked can chain multiple runtime instructions with and-then", () => {
  const result = page(`Add a paragraph called counter
Set the text of counter to 5
Add a paragraph called status
Add a button called reset
Set the text of reset to Reset
When the reset is clicked, set the text of counter to 0 and then set the text of status to Reset done`);
  const scriptBody = /<script>(.+?)<\/script>/.exec(result.html)![1]!;
  assert.match(scriptBody, /textContent=\"0\"/);
  assert.match(scriptBody, /textContent=\"Reset done\"/);
});

test("subtracting from the text of a target works and clamps to a real number even if text isn't numeric yet", () => {
  const result = page(`Add a paragraph called counter
Add a button called decrement
Set the text of decrement to Subtract one
When the decrement is clicked, subtract 1 from the text of counter`);
  const scriptBody = /<script>(.+?)<\/script>/.exec(result.html)![1]!;
  assert.match(scriptBody, /Number\(e\.textContent\)\|\|0\)\+\(-1\)/);
});

test("a click can read a text input's live value into another element's text", () => {
  const result = page(`Add a text input called name field
Add a paragraph called greeting
Add a button called submit
Set the text of submit to Say hello
When the submit is clicked, set the text of greeting to the value of name field`);
  const scriptBody = /<script>(.+?)<\/script>/.exec(result.html)![1]!;
  assert.match(scriptBody, /textContent=document\.getElementById\("element-1"\)\.value/);
});

test("a click can set a target's text to a random number in a range, and a backwards range is a clear error", () => {
  const result = page(`Add a paragraph called roll
Add a button called dice
Set the text of dice to Roll
When the dice is clicked, set the text of roll to a random number from 1 to 6`);
  const scriptBody = /<script>(.+?)<\/script>/.exec(result.html)![1]!;
  assert.match(scriptBody, /Math\.floor\(Math\.random\(\)\*\(6\)\)\+\(1\)/);
  invalid(`Add a paragraph called roll
Add a button called dice
Set the text of dice to Roll
When the dice is clicked, set the text of roll to a random number from 6 to 1`, /low end \(6\) can't be greater than its high end \(1\)/);
});

test("reading a value from an element that isn't an input, textarea, or select is a clear error", () => {
  invalid(`Add a paragraph called label
Add a paragraph called greeting
Add a button called submit
When the submit is clicked, set the text of greeting to the value of label`, /Only an input, a text box, or a dropdown has a value to read/);
});

test("a click can add or subtract a live input's value into the text of a target, and reject a non-readable source", () => {
  const addResult = page(`Add a text input called amount field
Add a paragraph called total
Set the text of total to 0
Add a button called go
Set the text of go to Go
When the go is clicked, add the value of amount field to the text of total`);
  const addScript = /<script>(.+?)<\/script>/.exec(addResult.html)![1]!;
  assert.match(addScript, /Number\(e\.textContent\)\|\|0\)\+\(\(Number\(document\.getElementById\("element-1"\)\.value\)\|\|0\)\)/);

  const subtractResult = page(`Add a text input called amount field
Add a paragraph called total
Set the text of total to 0
Add a button called go
Set the text of go to Go
When the go is clicked, subtract the value of amount field from the text of total`);
  const subtractScript = /<script>(.+?)<\/script>/.exec(subtractResult.html)![1]!;
  assert.match(subtractScript, /Number\(e\.textContent\)\|\|0\)\+\(-\(Number\(document\.getElementById\("element-1"\)\.value\)\|\|0\)\)/);

  invalid(`Add a paragraph called source
Add a paragraph called total
Add a button called go
Set the text of go to Go
When the go is clicked, add the value of source to the text of total`, /Only an input, a text box, or a dropdown has a value to read/);
});

test("a click can run a runtime if-conditional over a live input's value, with all five comparisons and wrapping any other instruction", () => {
  const greater = page(`Add a text input called score field
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of score field is greater than 50, set the text of result to high`);
  const greaterScript = /<script>(.+?)<\/script>/.exec(greater.html)![1]!;
  assert.match(greaterScript, /if\(\(Number\(document\.getElementById\("element-1"\)\.value\)\|\|0\)>\(50\)\)\{document\.getElementById\("element-2"\)\.textContent="high";\}/);

  for (const [word, operator] of Object.entries({ "greater than": ">", "less than": "<", "at least": ">=", "at most": "<=", "equal to": "===" })) {
    const result = page(`Add a text input called n
Add a paragraph called out
Set the text of out to 0
Add a button called go
Set the text of go to Go
When the go is clicked, if the value of n is ${word} 5, add 1 to the text of out`);
    const script = /<script>(.+?)<\/script>/.exec(result.html)![1]!;
    assert.match(script, new RegExp(`if\\(\\(Number\\(document\\.getElementById\\("element-1"\\)\\.value\\)\\|\\|0\\)${operator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\(5\\)\\)`));
  }

  // The "if" wraps only the instruction before "and then"; a later chained instruction still
  // runs unconditionally, since "and then" splits the whole click body before "if" ever sees it.
  const chained = page(`Add a text input called n
Add a paragraph called out
Set the text of out to 0
Add a button called go
Set the text of go to Go
When the go is clicked, if the value of n is less than 10, set the text of out to low and then add 1 to the text of out`);
  const chainedScript = /<script>(.+?)<\/script>/.exec(chained.html)![1]!;
  assert.match(chainedScript, /if\(.+?\)\{document\.getElementById\("element-2"\)\.textContent="low";\}\(function/);

  // The "if" can wrap an add-the-value-of instruction too, not just a plain set/add.
  const nested = page(`Add a text input called amount
Add a paragraph called total
Set the text of total to 0
Add a button called go
Set the text of go to Go
When the go is clicked, if the value of amount is greater than 0, add the value of amount to the text of total`);
  const nestedScript = /<script>(.+?)<\/script>/.exec(nested.html)![1]!;
  assert.match(nestedScript, /if\(\(Number\(document\.getElementById\("element-1"\)\.value\)\|\|0\)>\(0\)\)\{\(function/);

  invalid(`Add a paragraph called label
Add a paragraph called result
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of label is greater than 5, set the text of result to high`, /Only an input, a text box, or a dropdown has a value to read/);

  invalid(`Add a text input called n
Add a paragraph called out
Add a button called go
Set the text of go to Go
When the go is clicked, if the value of n is around 5, set the text of out to hmm`, /is not one of the supported click instructions/);
});

test("a click's if-conditional can have an otherwise (else) branch, which itself can be any supported instruction", () => {
  const basic = page(`Add a text input called score field
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of score field is greater than 50, set the text of result to high otherwise set the text of result to low`);
  const basicScript = /<script>(.+?)<\/script>/.exec(basic.html)![1]!;
  assert.match(basicScript, /if\(\(Number\(document\.getElementById\("element-1"\)\.value\)\|\|0\)>\(50\)\)\{document\.getElementById\("element-2"\)\.textContent="high";\}else\{document\.getElementById\("element-2"\)\.textContent="low";\}/);

  // An "and then" after the whole if/otherwise still runs unconditionally, same as after a
  // plain if with no otherwise: "and then" splits the click body before "if" ever sees it.
  const chained = page(`Add a text input called n
Add a paragraph called out
Set the text of out to 0
Add a button called go
Set the text of go to Go
When the go is clicked, if the value of n is greater than 5, set the text of out to big otherwise set the text of out to small and then add 1 to the text of out`);
  const chainedScript = /<script>(.+?)<\/script>/.exec(chained.html)![1]!;
  assert.match(chainedScript, /\}else\{document\.getElementById\("element-2"\)\.textContent="small";\}\(function/);

  // The otherwise branch can wrap a non-trivial instruction too, not just a plain set.
  const nested = page(`Add a text input called amount
Add a paragraph called total
Set the text of total to 0
Add a button called go
Set the text of go to Go
When the go is clicked, if the value of amount is greater than 0, add the value of amount to the text of total otherwise set the text of total to zero`);
  const nestedScript = /<script>(.+?)<\/script>/.exec(nested.html)![1]!;
  assert.match(nestedScript, /\}else\{document\.getElementById\("element-2"\)\.textContent="zero";\}/);

  // A plain if with no otherwise still compiles exactly as before (no regression).
  const plain = page(`Add a text input called n
Add a paragraph called out
Set the text of out to 0
Add a button called go
Set the text of go to Go
When the go is clicked, if the value of n is greater than 5, add 1 to the text of out`);
  const plainScript = /<script>(.+?)<\/script>/.exec(plain.html)![1]!;
  assert.doesNotMatch(plainScript, /else/);
});

test("a click's if-conditional can compare one live input's value against another live input's value", () => {
  const compared = page(`Add a text input called a
Add a text input called b
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of a is greater than the value of b, set the text of result to a wins otherwise set the text of result to b wins`);
  const comparedScript = /<script>(.+?)<\/script>/.exec(compared.html)![1]!;
  assert.match(comparedScript, /if\(\(Number\(document\.getElementById\("element-1"\)\.value\)\|\|0\)>\(Number\(document\.getElementById\("element-2"\)\.value\)\|\|0\)\)\{document\.getElementById\("element-3"\)\.textContent="a wins";\}else\{document\.getElementById\("element-3"\)\.textContent="b wins";\}/);

  // Comparing against a plain number literal still compiles exactly as before (no regression).
  const literal = page(`Add a text input called score
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of score is greater than 50, set the text of result to high otherwise set the text of result to low`);
  const literalScript = /<script>(.+?)<\/script>/.exec(literal.html)![1]!;
  assert.match(literalScript, /if\(\(Number\(document\.getElementById\("element-1"\)\.value\)\|\|0\)>\(50\)\)/);

  invalid(`Add a text input called a
Add a paragraph called b
Add a paragraph called result
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of a is greater than the value of b, set the text of result to high`, /Only an input, a text box, or a dropdown has a value to read/);
});

test("a click can repeat one instruction a fixed number of times, nesting safely and rejecting a bad count", () => {
  const basic = page(`Add a paragraph called counter
Set the text of counter to 0
Add a button called go
Set the text of go to Go
When the go is clicked, repeat 5 times, add 1 to the text of counter`);
  const basicScript = /<script>(.+?)<\/script>/.exec(basic.html)![1]!;
  assert.match(basicScript, /for\(let i=0;i<5;i\+\+\)\{\(function\(\)\{var e=document\.getElementById\("element-1"\);e\.textContent=String\(\(Number\(e\.textContent\)\|\|0\)\+\(1\)\);\}\)\(\);\}/);

  // Nested repeats need their own independently scoped counter (a bare "var i" would have the
  // inner loop's counter stomp the outer loop's, breaking the outer loop's iteration count).
  const nested = page(`Add a paragraph called counter
Set the text of counter to 0
Add a button called go
Set the text of go to Go
When the go is clicked, repeat 10 times, repeat 10 times, add 1 to the text of counter`);
  const nestedScript = /<script>(.+?)<\/script>/.exec(nested.html)![1]!;
  assert.match(nestedScript, /for\(let i=0;i<10;i\+\+\)\{for\(let i=0;i<10;i\+\+\)\{/);

  // A repeat can be the "if" instruction, and the "if" condition can still read a live value.
  const wrapped = page(`Add a text input called n
Add a paragraph called counter
Set the text of counter to 0
Add a button called go
Set the text of go to Go
When the go is clicked, if the value of n is greater than 5, repeat 3 times, add 1 to the text of counter`);
  const wrappedScript = /<script>(.+?)<\/script>/.exec(wrapped.html)![1]!;
  assert.match(wrappedScript, /if\(.+?\)\{for\(let i=0;i<3;i\+\+\)\{/);

  invalid(`Add a paragraph called counter
Add a button called go
Set the text of go to Go
When the go is clicked, repeat -1 times, add 1 to the text of counter`, /needs a count of 0 or more/);

  invalid(`Add a paragraph called counter
Add a button called go
Set the text of go to Go
When the go is clicked, repeat 999999999 times, add 1 to the text of counter`, /can run at most 100000 times per click/);

  // A count of exactly zero is allowed and simply produces a loop that runs zero times.
  const zero = page(`Add a paragraph called counter
Set the text of counter to 0
Add a button called go
Set the text of go to Go
When the go is clicked, repeat 0 times, add 1 to the text of counter`);
  const zeroScript = /<script>(.+?)<\/script>/.exec(zero.html)![1]!;
  assert.match(zeroScript, /for\(let i=0;i<0;i\+\+\)/);
});

test("resource URL case, CSS strings and ordinary attribute values are preserved", () => {
  const result = page(`Add an image called photo
Set the source of photo to https://example.com/MyPhoto.png
Set the alternative text of photo to My Photo.
Add a paragraph called caption
Set the background image of caption to url("https://example.com/MyPhoto10seconds.png")
Set the font family of caption to Example Family
Set the text of caption to Case Stays. And punctuation.`);
  assert.equal(result.ir.elements[1]!.attributes.src, "https://example.com/MyPhoto.png");
  assert.equal(result.ir.elements[1]!.attributes.alt, "My Photo.");
  assert.match(result.ir.elements[2]!.styles["background-image"]!, /MyPhoto10seconds.png/);
  assert.equal(result.ir.elements[2]!.styles["font-family"], "Example Family");
});

test("source, element and nesting limits fail explicitly", () => {
  assert.equal(compilePageSource("x".repeat(20001)).ok, false);
  invalid("Add a paragraph called greeting\nSet the text of greeting to bad\u0000text", /control characters/);
  invalid(Array.from({ length: 201 }, (_, index) => `Add a paragraph called item ${index}`).join("\n"), /at most 200/);
  invalid(Array.from({ length: 35 }, (_, index) => `Add a section called level ${index}${index ? ` inside level ${index - 1}` : ""}`).join("\n"), /32 levels/);
  invalid("Add a constructor called example", /Unknown element/);
  invalid("Add a paragraph called example\nMake the background constructor", /Invalid value/);
});
