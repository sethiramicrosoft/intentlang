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

test("a plain page statement line can chain several instructions with \"and then\", not just a click body", () => {
  const chained = page(`Add a paragraph called note
Add a paragraph called label and then set the text of label to Note and then set the text of note to Hello`);
  assert.equal(chained.ir.elements.find((element) => element.name === "label")!.text, "Note");
  assert.equal(chained.ir.elements.find((element) => element.name === "note")!.text, "Hello");
  // An ordinary "and" that is not "and then" must still read as ordinary literal text, not a
  // chain split, so display text containing the word "and" is completely unaffected.
  const ordinary = page(`Add a paragraph called note
Set the text of note to salt and pepper`);
  assert.equal(ordinary.ir.elements[1]!.text, "salt and pepper");
  // A "When ... is clicked" trigger's own body already chains its instructions with "and
  // then" through the click compiler -- the top-level line splitter must never re-split that
  // body itself, or only the trigger's first instruction would ever end up attached to it.
  const trigger = page(`Add a button called go
Add a paragraph called result
Set the text of result to none
When the go is clicked, set the text of result to hi and then set the text of result to bye`);
  assert.ok(trigger.html.includes("addEventListener"));
  // An error in a later chained part is still reported, not silently dropped.
  invalid(`Add a paragraph called note
Set the text of note to hi and then set the text of missing to bye`, /no earlier element called missing/);
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

test("a click can multiply or divide the text of a target by a fixed number, and dividing by zero is a clear error", () => {
  const multiplied = page(`Add a paragraph called total
Set the text of total to 5
Add a button called go
Set the text of go to Go
When the go is clicked, multiply the text of total by 3`);
  const multipliedScript = /<script>(.+?)<\/script>/.exec(multiplied.html)![1]!;
  assert.match(multipliedScript, /Number\(e\.textContent\)\|\|0\)\*\(3\)/);

  const divided = page(`Add a paragraph called total
Set the text of total to 10
Add a button called go
Set the text of go to Go
When the go is clicked, divide the text of total by 4`);
  const dividedScript = /<script>(.+?)<\/script>/.exec(divided.html)![1]!;
  assert.match(dividedScript, /Number\(e\.textContent\)\|\|0\)\/\(4\)/);

  // A negative multiplier is fine (it's just another fixed number), only dividing by
  // exactly zero is rejected, since that would produce an undefined result.
  const negative = page(`Add a paragraph called total
Set the text of total to 5
Add a button called go
Set the text of go to Go
When the go is clicked, multiply the text of total by -2`);
  const negativeScript = /<script>(.+?)<\/script>/.exec(negative.html)![1]!;
  assert.match(negativeScript, /Number\(e\.textContent\)\|\|0\)\*\(-2\)/);

  invalid(`Add a paragraph called total
Set the text of total to 10
Add a button called go
Set the text of go to Go
When the go is clicked, divide the text of total by 0`, /would produce an undefined result/);
});

test("a click can hide, show, or toggle the visibility of any element", () => {
  const hidden = page(`Add a paragraph called details
Set the text of details to Secret info
Add a button called hide it
Set the text of hide it to Hide
When the hide it is clicked, hide details`);
  const hiddenScript = /<script>(.+?)<\/script>/.exec(hidden.html)![1]!;
  assert.match(hiddenScript, /document\.getElementById\("element-1"\)\.hidden=true;/);

  const shown = page(`Add a paragraph called details
Set the text of details to Secret info
Add a button called show it
Set the text of show it to Show
When the show it is clicked, show details`);
  const shownScript = /<script>(.+?)<\/script>/.exec(shown.html)![1]!;
  assert.match(shownScript, /document\.getElementById\("element-1"\)\.hidden=false;/);

  const toggled = page(`Add a paragraph called details
Set the text of details to Secret info
Add a button called toggle
Set the text of toggle to Toggle
When the toggle is clicked, toggle the visibility of details`);
  const toggledScript = /<script>(.+?)<\/script>/.exec(toggled.html)![1]!;
  assert.match(toggledScript, /e\.hidden=!e\.hidden;/);

  // Hide/show/toggle work on any element, not just form controls -- unlike the readable/
  // writable-value instructions, there's no tag restriction here.
  const container = page(`Add a container called panel
Add a paragraph called label inside panel
Set the text of label to Inside the panel
Add a button called close
Set the text of close to Close
When the close is clicked, hide panel`);
  const containerScript = /<script>(.+?)<\/script>/.exec(container.html)![1]!;
  assert.match(containerScript, /document\.getElementById\("element-1"\)\.hidden=true;/);

  invalid(`Add a button called go
Set the text of go to Go
When the go is clicked, hide missing`, /There is no earlier element called missing/);
});

test("a click can move keyboard focus to any element with \"focus <name>\"", () => {
  const result = page(`Add a text input called search field
Add a button called open search
Set the text of open search to Search
When the open search is clicked, show search field and then focus search field`);
  const scriptBody = /<script>(.+?)<\/script>/.exec(result.html)![1]!;
  assert.match(scriptBody, /document\.getElementById\("element-1"\)\.hidden=false;document\.getElementById\("element-1"\)\.focus\(\);/);

  invalid(`Add a button called go
Set the text of go to Go
When the go is clicked, focus missing`, /There is no earlier element called missing/);
});

test("a click can disable or enable a form control with \"disable <name>\"/\"enable <name>\"", () => {
  const conditional = page(`Add a checkbox called agree
Add a button called submit
Set the text of submit to Submit
Add a button called toggle agree
Set the text of toggle agree to Toggle
When the toggle agree is clicked, if agree is checked, disable submit otherwise enable submit`);
  const conditionalScript = /<script>(.+?)<\/script>/.exec(conditional.html)![1]!;
  assert.match(conditionalScript, /if\(document\.getElementById\("element-1"\)\.checked\)\{document\.getElementById\("element-2"\)\.disabled=true;\}else\{document\.getElementById\("element-2"\)\.disabled=false;\}/);

  // Works on any form control that supports ".disabled", not just buttons: input, textarea,
  // select, optgroup, and fieldset.
  const input = page(`Add a text input called notes
Add a button called unlock
Set the text of unlock to Unlock
When the unlock is clicked, enable notes`);
  const inputScript = /<script>(.+?)<\/script>/.exec(input.html)![1]!;
  assert.match(inputScript, /document\.getElementById\("element-1"\)\.disabled=false;/);

  // A paragraph (or any element without a ".disabled" the browser honors) is a clear error.
  invalid(`Add a paragraph called label
Add a button called go
Set the text of go to Go
When the go is clicked, disable label`, /Only a button, an input, a text box, a dropdown, or a field group can be disabled/);
});

test("When the <field> changes reacts to a live edit or selection, not a click", () => {
  const dropdown = page(`Add a dropdown called favorite color
Add an option called red inside favorite color
Add an option called blue inside favorite color
Set the text of red to Red
Set the text of blue to Blue
Add a paragraph called result
When the favorite color changes, set the text of result to the value of favorite color`);
  const dropdownScript = /<script>(.+?)<\/script>/.exec(dropdown.html)![1]!;
  assert.match(dropdownScript, /addEventListener\("change",function\(\)\{document\.getElementById\("element-4"\)\.textContent=document\.getElementById\("element-1"\)\.value;\}\);/);

  // The same closed instruction set backs this trigger too, and it works on a text input
  // or a text box, not just a dropdown.
  const textInput = page(`Add a text input called name field
Add a paragraph called echo
When the name field changes, set the text of echo to the value of name field`);
  const textInputScript = /<script>(.+?)<\/script>/.exec(textInput.html)![1]!;
  assert.match(textInputScript, /addEventListener\("change"/);

  invalid(`Add a button called go
Set the text of go to Go
When the go changes, hide go`, /Only an input, a text box, or a dropdown can change/);
});

test("When Enter is pressed in <field> fires on a keydown, not a click, and prevents the default Enter behavior", () => {
  const search = page(`Add a text input called search field
Add a paragraph called result
Set the text of result to none
When enter is pressed in search field, set the text of result to the value of search field`);
  const script = /<script>(.+?)<\/script>/.exec(search.html)![1]!;
  assert.match(script, /addEventListener\("keydown",function\(event\)\{if\(event\.key==="Enter"\)\{event\.preventDefault\(\);document\.getElementById\("element-2"\)\.textContent=document\.getElementById\("element-1"\)\.value;\}\}\);/);

  // Works on a dropdown too, using the same closed instruction set and readable-value check
  // as "the value of ..." elsewhere.
  const dropdown = page(`Add a dropdown called favorite color
Add an option called red inside favorite color
Set the text of red to Red
Add a paragraph called result
When enter is pressed in favorite color, set the text of result to the value of favorite color`);
  assert.match(/<script>(.+?)<\/script>/.exec(dropdown.html)![1]!, /addEventListener\("keydown"/);

  invalid(`Add a button called go
Set the text of go to Go
When enter is pressed in go, hide go`, /Only an input, a text box, or a dropdown can receive a key press/);
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

test("a click can read a dropdown's selected option's own displayed label, even when its value differs", () => {
  const withDivergentValues = page(`Add a dropdown called favorite color
Add an option called red inside favorite color
Add an option called blue inside favorite color
Set the text of red to Red
Set the text of blue to Blue
Set the value of red to r
Set the value of blue to b
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, set the text of result to the selected label of favorite color`);
  const script = /<script>(.+?)<\/script>/.exec(withDivergentValues.html)![1]!;
  assert.match(script, /var s=document\.getElementById\("element-1"\);return s\.options\[s\.selectedIndex\]\?s\.options\[s\.selectedIndex\]\.text:"";/);

  invalid(`Add a text input called n
Add a paragraph called result
Add a button called go
Set the text of go to Go
When the go is clicked, set the text of result to the selected label of n`, /Only a dropdown has a selected option's label/);
});

test("a click can read a live character count with \"the number of characters in the value of ...\"", () => {
  const counter = page(`Add a text input called message
Add a paragraph called counter
Set the text of counter to 0
When the message changes, set the text of counter to the number of characters in the value of message`);
  const script = /<script>(.+?)<\/script>/.exec(counter.html)![1]!;
  assert.match(script, /textContent=String\(document\.getElementById\("element-1"\)\.value\.length\);/);

  // Also works from a click, using the same source-validation as every other "the value of ..."
  // reference (must be an input, a text box, or a dropdown).
  const fromClick = page(`Add a text input called message
Add a paragraph called counter
Set the text of counter to 0
Add a button called check
Set the text of check to Check
When the check is clicked, set the text of counter to the number of characters in the value of message`);
  assert.match(/<script>(.+?)<\/script>/.exec(fromClick.html)![1]!, /\.value\.length\)/);

  invalid(`Add a button called go
Set the text of go to Go
Add a paragraph called counter
When the go is clicked, set the text of counter to the number of characters in the value of go`, /Only an input, a text box, or a dropdown has a value to read/);
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
When the go is clicked, if the value of n resembles 5, set the text of out to hmm`, /is not one of the supported click instructions/);
});

test("a click's if-conditional can check a fixed inclusive range with \"is between ... and ...\"", () => {
  const withOtherwise = page(`Add a text input called score field
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of score field is between 1 and 10, set the text of result to valid otherwise set the text of result to out of range`);
  const script = /<script>(.+?)<\/script>/.exec(withOtherwise.html)![1]!;
  assert.match(script, /if\(\(Number\(document\.getElementById\("element-1"\)\.value\)\|\|0\)>=1&&\(Number\(document\.getElementById\("element-1"\)\.value\)\|\|0\)<=10\)\{document\.getElementById\("element-2"\)\.textContent="valid";\}else\{document\.getElementById\("element-2"\)\.textContent="out of range";\}/);

  // A backwards range (low end greater than high end) is a clear compile-time error, not a
  // silently-always-false condition.
  invalid(`Add a text input called score field
Add a paragraph called result
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of score field is between 10 and 1, set the text of result to valid`, /range .*between 10 and 1.* is backwards/);

  // The target must still be an input/text box/dropdown, same as every other "the value
  // of ..." reference.
  invalid(`Add a paragraph called label
Add a paragraph called result
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of label is between 1 and 10, set the text of result to valid`, /Only an input, a text box, or a dropdown has a value to read/);
});

test("a click's if-conditional can check a live text's own length with \"has ... characters\"", () => {
  const fewer = page(`Add a text input called password
Add a paragraph called hint
Set the text of hint to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of password has fewer than 8 characters, set the text of hint to too short otherwise set the text of hint to looks good`);
  const fewerScript = /<script>(.+?)<\/script>/.exec(fewer.html)![1]!;
  assert.match(fewerScript, /if\(String\(document\.getElementById\("element-1"\)\.value\)\.length<8\)\{document\.getElementById\("element-2"\)\.textContent="too short";\}else\{document\.getElementById\("element-2"\)\.textContent="looks good";\}/);

  for (const [word, operator] of Object.entries({ "more than": ">", "fewer than": "<", "at least": ">=", "at most": "<=", "exactly": "===" })) {
    const result = page(`Add a text input called code
Add a paragraph called out
Set the text of out to 0
Add a button called go
Set the text of go to Go
When the go is clicked, if the value of code has ${word} 6 characters, add 1 to the text of out`);
    const script = /<script>(.+?)<\/script>/.exec(result.html)![1]!;
    assert.match(script, new RegExp(`if\\(String\\(document\\.getElementById\\("element-1"\\)\\.value\\)\\.length${operator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}6\\)`));
  }

  // The target must still be an input/text box/dropdown, same as every other "the value
  // of ..." reference.
  invalid(`Add a paragraph called label
Add a button called go
Set the text of go to Go
When the go is clicked, if the value of label has more than 5 characters, set the text of label to long`, /Only an input, a text box, or a dropdown has a value to read/);
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

test("a click's if-conditional can compare a live input's text with is/is not/contains/starts with/ends with", () => {
  const equals = page(`Add a text input called name field
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of name field is admin, set the text of result to welcome admin otherwise set the text of result to hello guest`);
  const equalsScript = /<script>(.+?)<\/script>/.exec(equals.html)![1]!;
  assert.match(equalsScript, /if\(String\(document\.getElementById\("element-1"\)\.value\)==="admin"\)\{document\.getElementById\("element-2"\)\.textContent="welcome admin";\}else\{document\.getElementById\("element-2"\)\.textContent="hello guest";\}/);

  const notEquals = page(`Add a text input called name field
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of name field is not admin, set the text of result to guest`);
  const notEqualsScript = /<script>(.+?)<\/script>/.exec(notEquals.html)![1]!;
  assert.match(notEqualsScript, /if\(String\(document\.getElementById\("element-1"\)\.value\)!=="admin"\)/);

  const contains = page(`Add a text input called message
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of message contains urgent, set the text of result to flagged`);
  const containsScript = /<script>(.+?)<\/script>/.exec(contains.html)![1]!;
  assert.match(containsScript, /if\(String\(document\.getElementById\("element-1"\)\.value\)\.includes\("urgent"\)\)/);

  const startsWith = page(`Add a text input called code
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of code starts with US, set the text of result to domestic`);
  const startsWithScript = /<script>(.+?)<\/script>/.exec(startsWith.html)![1]!;
  assert.match(startsWithScript, /if\(String\(document\.getElementById\("element-1"\)\.value\)\.startsWith\("US"\)\)/);

  const endsWith = page(`Add a text input called file name
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of file name ends with .txt, set the text of result to text file`);
  const endsWithScript = /<script>(.+?)<\/script>/.exec(endsWith.html)![1]!;
  assert.match(endsWithScript, /if\(String\(document\.getElementById\("element-1"\)\.value\)\.endsWith\("\.txt"\)\)/);

  // A text comparison's right-hand side can be another live input's value, not just a literal.
  const compared = page(`Add a text input called a
Add a text input called b
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of a is the value of b, set the text of result to match otherwise set the text of result to different`);
  const comparedScript = /<script>(.+?)<\/script>/.exec(compared.html)![1]!;
  assert.match(comparedScript, /if\(String\(document\.getElementById\("element-1"\)\.value\)===String\(document\.getElementById\("element-2"\)\.value\)\)/);

  // A numeric comparison still compiles exactly as before -- the text-comparison regex is
  // only tried when the numeric one doesn't match (no regression).
  const numeric = page(`Add a text input called score
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of score is greater than 50, set the text of result to high otherwise set the text of result to low`);
  const numericScript = /<script>(.+?)<\/script>/.exec(numeric.html)![1]!;
  assert.match(numericScript, /if\(\(Number\(document\.getElementById\("element-1"\)\.value\)\|\|0\)>\(50\)\)/);

  invalid(`Add a paragraph called label
Add a paragraph called result
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of label contains hi, set the text of result to yes`, /Only an input, a text box, or a dropdown has a value to read/);
});

test("a click can set or clear a live input's own value, including copying another input's value", () => {
  const setLiteral = page(`Add a text input called name field
Add a button called reset
Set the text of reset to Reset
When the reset is clicked, set the value of name field to guest`);
  const setLiteralScript = /<script>(.+?)<\/script>/.exec(setLiteral.html)![1]!;
  assert.match(setLiteralScript, /document\.getElementById\("element-1"\)\.value="guest";/);

  const cleared = page(`Add a text input called name field
Add a button called clear
Set the text of clear to Clear
When the clear is clicked, clear the value of name field`);
  const clearedScript = /<script>(.+?)<\/script>/.exec(cleared.html)![1]!;
  assert.match(clearedScript, /document\.getElementById\("element-1"\)\.value="";/);

  // The right-hand side of "set the value of ..." can be another live input's value (a
  // copy), checked before the plainer literal-text form for the same reason "set the text
  // of ... to the value of ..." is checked before "set the text of ... to ...".
  const copied = page(`Add a text input called a
Add a text input called b
Add a button called copy
Set the text of copy to Copy
When the copy is clicked, set the value of b to the value of a`);
  const copiedScript = /<script>(.+?)<\/script>/.exec(copied.html)![1]!;
  assert.match(copiedScript, /document\.getElementById\("element-2"\)\.value=document\.getElementById\("element-1"\)\.value;/);

  // Setting/clearing/copying can all chain with "and then" alongside any other instruction.
  const chained = page(`Add a text input called message
Add a paragraph called result
Set the text of result to none
Add a button called send
Set the text of send to Send
When the send is clicked, set the text of result to the value of message and then clear the value of message`);
  const chainedScript = /<script>(.+?)<\/script>/.exec(chained.html)![1]!;
  assert.match(chainedScript, /document\.getElementById\("element-2"\)\.textContent=document\.getElementById\("element-1"\)\.value;document\.getElementById\("element-1"\)\.value="";/);

  invalid(`Add a paragraph called label
Add a button called reset
Set the text of reset to Reset
When the reset is clicked, set the value of label to guest`, /Only an input, a text box, or a dropdown has a value to set/);

  invalid(`Add a paragraph called label
Add a button called reset
Set the text of reset to Reset
When the reset is clicked, clear the value of label`, /Only an input, a text box, or a dropdown has a value to clear/);

  invalid(`Add a text input called a
Add a text input called b
Add a button called copy
Set the text of copy to Copy
When the copy is clicked, set the value of b to the value of missing`, /There is no earlier element called missing/);
});

test("a click can check/uncheck a checkbox or radio button and branch on its checked state", () => {
  const branch = page(`Add a checkbox called agree
Add a paragraph called result
Set the text of result to none
Add a button called submit
Set the text of submit to Submit
When the submit is clicked, if agree is checked, set the text of result to yes otherwise set the text of result to no`);
  const branchScript = /<script>(.+?)<\/script>/.exec(branch.html)![1]!;
  assert.match(branchScript, /if\(document\.getElementById\("element-1"\)\.checked\)\{document\.getElementById\("element-2"\)\.textContent="yes";\}else\{document\.getElementById\("element-2"\)\.textContent="no";\}/);

  // "the" is optional before the checkbox's name, and "is not checked" negates the condition.
  const negated = page(`Add a checkbox called agree
Add a paragraph called result
Set the text of result to none
Add a button called submit
Set the text of submit to Submit
When the submit is clicked, if the agree is not checked, set the text of result to please agree`);
  const negatedScript = /<script>(.+?)<\/script>/.exec(negated.html)![1]!;
  assert.match(negatedScript, /if\(!document\.getElementById\("element-1"\)\.checked\)/);

  // A radio button has the same checked state as a checkbox.
  const radio = page(`Add a radio button called opt a
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if opt a is checked, set the text of result to chosen`);
  const radioScript = /<script>(.+?)<\/script>/.exec(radio.html)![1]!;
  assert.match(radioScript, /if\(document\.getElementById\("element-1"\)\.checked\)/);

  const toggled = page(`Add a checkbox called agree
Add a button called turn on
Set the text of turn on to Turn on
Add a button called turn off
Set the text of turn off to Turn off
When the turn on is clicked, check agree
When the turn off is clicked, uncheck agree`);
  const toggledScript = /<script>(.+?)<\/script>/.exec(toggled.html)![1]!;
  assert.match(toggledScript, /document\.getElementById\("element-1"\)\.checked=true;/);
  assert.match(toggledScript, /document\.getElementById\("element-1"\)\.checked=false;/);

  // "if the value of X is checked, ..." is NOT read as a checkbox condition -- the negative
  // lookahead keeps ifChecked from matching it, and since "checked" isn't a recognized
  // numeric/text comparison word either... except "is" is a text-equality comparison against
  // any literal phrase, so this is actually still valid: a text comparison against "checked".
  const textEquality = page(`Add a text input called n
Add a paragraph called result
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of n is checked, set the text of result to yes`);
  const textEqualityScript = /<script>(.+?)<\/script>/.exec(textEquality.html)![1]!;
  assert.match(textEqualityScript, /if\(String\(document\.getElementById\("element-1"\)\.value\)==="checked"\)/);

  invalid(`Add a text input called n
Add a paragraph called result
Add a button called check
Set the text of check to Check
When the check is clicked, if n is checked, set the text of result to yes`, /Only a checkbox or a radio button has a checked state/);

  invalid(`Add a text input called n
Add a button called go
Set the text of go to Go
When the go is clicked, check n`, /Only a checkbox or a radio button has a checked state/);

  invalid(`Add a text input called n
Add a button called go
Set the text of go to Go
When the go is clicked, uncheck n`, /Only a checkbox or a radio button has a checked state/);
});

test("radio buttons under the same parent are auto-grouped by a shared HTML name, for real mutual exclusivity", () => {
  const grouped = page(`Add a radio button called option a
Add a radio button called option b
Add a section called other group
Add a radio button called option c inside other group`);
  const inputs = grouped.html.match(/<input[^>]*type="radio"[^>]*>/g)!;
  assert.equal(inputs.length, 3);
  // Siblings under the implicit page body share one group...
  assert.match(inputs[0]!, /name="page-radio-group"/);
  assert.match(inputs[1]!, /name="page-radio-group"/);
  // ...while a radio button under a different parent gets its own, separate group.
  assert.doesNotMatch(inputs[2]!, /name="page-radio-group"/);
  assert.match(inputs[2]!, /name="element-3-radio-group"/);

  // A checkbox is unaffected -- it has no "name" attribute at all, since only radio buttons
  // need grouping for mutual exclusivity.
  const withCheckbox = page(`Add a checkbox called agree`);
  assert.doesNotMatch(withCheckbox.html.match(/<input[^>]*>/)![0]!, /name=/);
});

test("a click can flip a checkbox or radio button's own checked state with \"toggle whether ... is checked\"", () => {
  const flip = page(`Add a checkbox called agree
Add a button called turn
Set the text of turn to Turn
When the turn is clicked, toggle whether agree is checked`);
  const script = /<script>(.+?)<\/script>/.exec(flip.html)![1]!;
  assert.match(script, /\(function\(\)\{var e=document\.getElementById\("element-1"\);e\.checked=!e\.checked;\}\)\(\);/);

  // "the" is optional before the checkbox's name, matching every other instruction's target.
  const withThe = page(`Add a radio button called opt
Add a button called turn
Set the text of turn to Turn
When the turn is clicked, toggle whether the opt is checked`);
  assert.match(/<script>(.+?)<\/script>/.exec(withThe.html)![1]!, /var e=document\.getElementById\("element-1"\)/);

  invalid(`Add a text input called n
Add a button called go
Set the text of go to Go
When the go is clicked, toggle whether n is checked`, /Only a checkbox or a radio button has a checked state/);
});

test("When the page loads runs its instructions immediately, using the same closed instruction set as a click", () => {
  const basic = page(`Add a paragraph called greeting
Set the text of greeting to loading...
When the page loads, set the text of greeting to Welcome!`);
  const basicScript = /<script>(.+?)<\/script>/.exec(basic.html)![1]!;
  assert.match(basicScript, /^"use strict";document\.getElementById\("element-1"\)\.textContent="Welcome!";$/);

  // The same recursive compiler backs both triggers, so any click instruction (random,
  // if, repeat, ...) works here too, unchanged.
  const random = page(`Add a paragraph called roll
Set the text of roll to 0
When the page loads, set the text of roll to a random number from 1 to 6`);
  const randomScript = /<script>(.+?)<\/script>/.exec(random.html)![1]!;
  assert.match(randomScript, /Math\.floor\(Math\.random\(\)/);

  // Page-load instructions run before any click handler is even registered, and in source
  // order, so a page-load default is visibly overridden by a later click as expected.
  const both = page(`Add a paragraph called counter
Set the text of counter to 0
Add a button called go
Set the text of go to Go
When the page loads, set the text of counter to 10
When the go is clicked, add 1 to the text of counter`);
  const bothScript = /<script>(.+?)<\/script>/.exec(both.html)![1]!;
  assert.match(bothScript, /^"use strict";document\.getElementById\("element-1"\)\.textContent="10";document\.getElementById\("element-2"\)\.addEventListener/);

  // A page using neither "When ... is clicked" nor "When the page loads" stays entirely
  // script-free, byte for byte, exactly as before this feature existed.
  const scriptless = page(`Add a paragraph called greeting
Set the text of greeting to Hello`);
  assert.equal(/<script>/.test(scriptless.html), false);

  invalid(`Add a paragraph called greeting
When the page loads, do something silly`, /is not one of the supported click instructions/);
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
