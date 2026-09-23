import assert from "node:assert/strict";
import test from "node:test";
import { compileEnglishSource } from "../src/english.js";
import { expandMacros, usesMacroGrammar } from "../src/web-macros.js";

function page(source: string) {
  const result = compileEnglishSource(source);
  if (!result.ok) assert.fail(JSON.stringify(result.diagnostics, null, 2));
  if (result.ir.kind !== "page") assert.fail("Expected a page document");
  return { ...result, ir: result.ir };
}
function invalid(source: string, pattern?: RegExp) {
  const result = compileEnglishSource(source);
  if (result.ok) assert.fail("Expected failure for: " + source);
  if (pattern) assert.match(JSON.stringify(result.diagnostics), pattern);
  return result.diagnostics;
}
function textOf(ir: ReturnType<typeof page>["ir"], name: string): string {
  const element = ir.elements.find((item) => item.name === name);
  assert.ok(element, `Expected an element named "${name}"`);
  return element.text;
}

test("a variable sentence computes a value and substitutes it into a Set instruction", () => {
  const { ir } = page(`Add a paragraph called total display inside page
The price is 12.
The quantity is 3.
The total is the price times the quantity.
Set the text of total display to total`);
  assert.equal(textOf(ir, "total display"), "36");
});

test("plus, minus, and divided by all work, and a variable can alias another variable", () => {
  const { ir } = page(`Add a paragraph called sum display inside page
Add a paragraph called difference display inside page
Add a paragraph called quotient display inside page
Add a paragraph called copy display inside page
The a is 10.
The b is 4.
The sum is the a plus the b.
The difference is the a minus the b.
The quotient is the a divided by the b.
The copy is the a.
Set the text of sum display to sum
Set the text of difference display to difference
Set the text of quotient display to quotient
Set the text of copy display to copy`);
  assert.equal(textOf(ir, "sum display"), "14");
  assert.equal(textOf(ir, "difference display"), "6");
  assert.equal(textOf(ir, "quotient display"), "2.5");
  assert.equal(textOf(ir, "copy display"), "10");
});

test("an If sentence keeps its instruction only when the condition is true", () => {
  const { ir } = page(`Add a paragraph called message inside page
The score is 42.
If the score is greater than 10, set the text of message to high score`);
  assert.equal(textOf(ir, "message"), "high score");
});

test("Otherwise runs when the matching If condition was false", () => {
  const { ir } = page(`Add a paragraph called message inside page
The score is 2.
If the score is greater than 10, set the text of message to high score
Otherwise, set the text of message to try again`);
  assert.equal(textOf(ir, "message"), "try again");
});

test("every comparator word works", () => {
  const cases: [string, number, number, boolean][] = [
    ["greater than", 5, 3, true],
    ["less than", 5, 3, false],
    ["equal to", 3, 3, true],
    ["at least", 3, 3, true],
    ["at most", 4, 3, false],
  ];
  for (const [comparator, value, target, expectTrue] of cases) {
    const { ir } = page(`Add a paragraph called message inside page
The score is ${value}.
If the score is ${comparator} ${target}, set the text of message to yes
Otherwise, set the text of message to no`);
    assert.equal(textOf(ir, "message"), expectTrue ? "yes" : "no");
  }
});

test("For each repeats one instruction per list item and substitutes the loop word", () => {
  const { ir } = page(`Add a bullet list called colors inside page
For each color in red, green and blue, add a list item called swatch color inside colors
For each color in red, green and blue, set the text of swatch color to color`);
  assert.equal(textOf(ir, "swatch red"), "red");
  assert.equal(textOf(ir, "swatch green"), "green");
  assert.equal(textOf(ir, "swatch blue"), "blue");
});

test("For each accepts a two-item list without a comma before and", () => {
  const { ir } = page(`Add a bullet list called colors inside page
For each color in red and blue, add a list item called swatch color inside colors`);
  assert.equal(textOf(ir, "swatch red"), "");
  assert.equal(textOf(ir, "swatch blue"), "");
  assert.equal(ir.elements.filter((element) => element.tag === "li").length, 2);
});

function suggestionOf(source: string): { label: string; replacement: string } {
  const result = compileEnglishSource(source);
  if (result.ok) assert.fail("Expected a typo diagnostic for: " + source);
  const diagnostic = result.diagnostics.find((item) => item.suggestions?.length);
  assert.ok(diagnostic, `Expected a suggestion for: ${source}\n${JSON.stringify(result.diagnostics, null, 2)}`);
  assert.equal(diagnostic!.category, "typo");
  return diagnostic!.suggestions![0]!;
}

test("a misspelled If keyword is offered as a one-click fix", () => {
  const suggestion = suggestionOf(`Add a paragraph called message inside page
The score is 5.
Iff the score is greater than 3, set the text of message to high`);
  assert.equal(suggestion.replacement, "if the score is greater than 3, set the text of message to high");
});

test("a misspelled comparator (than vs then) is offered as a one-click fix", () => {
  const suggestion = suggestionOf(`Add a paragraph called message inside page
The score is 5.
If the score is greater then 3, set the text of message to high`);
  assert.equal(suggestion.replacement, "If the score is greater than 3, set the text of message to high");
});

test("a misspelled leading The is offered as a one-click fix", () => {
  const suggestion = suggestionOf(`Add a paragraph called message inside page
Th score is 5.
Set the text of message to score`);
  assert.equal(suggestion.replacement, "the score is 5.");
});

test("a misspelled is (in a variable sentence) is offered as a one-click fix", () => {
  const suggestion = suggestionOf(`Add a paragraph called message inside page
The score iz 5.
Set the text of message to score`);
  assert.equal(suggestion.replacement, "The score is 5.");
});

test("a misspelled Otherwise keyword is offered as a one-click fix", () => {
  const suggestion = suggestionOf(`Add a paragraph called message inside page
The score is 5.
If the score is greater than 3, set the text of message to high
Otherwize, set the text of message to low`);
  assert.equal(suggestion.replacement, "otherwise, set the text of message to low");
});

test("a misspelled For keyword is offered as a one-click fix", () => {
  const suggestion = suggestionOf(`Add a bullet list called colors inside page
Fr each color in red and blue, add a list item called swatch color inside colors`);
  assert.equal(suggestion.replacement, "for each color in red and blue, add a list item called swatch color inside colors");
});

test("a misspelled in keyword (For each) is offered as a one-click fix", () => {
  const suggestion = suggestionOf(`Add a bullet list called colors inside page
For each color n red and blue, add a list item called swatch color inside colors`);
  assert.equal(suggestion.replacement, "For each color in red and blue, add a list item called swatch color inside colors");
});

test("referencing an unknown variable that is close to a known one suggests the known name", () => {
  const suggestion = suggestionOf(`Add a paragraph called message inside page
The score is 5.
If the scoer is greater than 3, set the text of message to high`);
  assert.equal(suggestion.replacement, "If the score is greater than 3, set the text of message to high");
});

test("keywords, comparators, and variable names are not case sensitive", () => {
  const { ir } = page(`ADD A PARAGRAPH CALLED MESSAGE INSIDE PAGE
THE SCORE IS 5.
IF THE SCORE IS GREATER THAN 3, SET THE TEXT OF MESSAGE TO HIGH
OTHERWISE, SET THE TEXT OF MESSAGE TO LOW`);
  assert.equal(textOf(ir, "message"), "HIGH");
});

test("a variable defined in one case is found when referenced in another case", () => {
  const { ir } = page(`Add a paragraph called message inside page
The Score is 5.
If the SCORE is greater than 3, set the text of message to high`);
  assert.equal(textOf(ir, "message"), "high");
});

test("a misspelled keyword in any case is still offered as a one-click fix", () => {
  const suggestion = suggestionOf(`Add a paragraph called message inside page
The score is 5.
IFF THE SCORE IS GREATER THAN 3, set the text of message to high`);
  assert.equal(suggestion.replacement, "if THE SCORE IS GREATER THAN 3, set the text of message to high");
});

test("ordinary page instructions are never mistaken for a macro typo", () => {
  const { ir } = page(`Add a paragraph called greeting inside page
Set the text of greeting to Hello, world!
Put greeting inside page`);
  assert.equal(textOf(ir, "greeting"), "Hello, world!");
});

test("a source without any variable, If, or For each sentence is untouched by macro expansion", () => {
  const source = `Add a paragraph called greeting inside page
Set the text of greeting to Hello, world!`;
  const expanded = expandMacros(source);
  assert.ok(expanded.ok);
  assert.equal(expanded.source, source);
  assert.equal(usesMacroGrammar(source), false);
});

test("referencing an undefined variable in an If sentence is a clear error", () => {
  invalid(`Add a paragraph called message inside page
If the score is greater than 10, set the text of message to high score`, /never given a value/);
});

test("comparing to an unknown variable is a clear error", () => {
  invalid(`Add a paragraph called message inside page
The score is 5.
If the score is greater than the limit, set the text of message to high score`, /not a number or a known variable/);
});

test("Otherwise without a preceding If is a clear error", () => {
  invalid(`Add a paragraph called message inside page
Otherwise, set the text of message to try again`, /must come right after an/);
});

test("dividing by zero is a clear error rather than producing NaN or Infinity", () => {
  invalid(`Add a paragraph called message inside page
The score is 5.
The share is the score divided by 0.
Set the text of message to share`, /not part of the page language/);
});

test("For each with an empty list is a clear error", () => {
  invalid(`Add a bullet list called colors inside page
For each color in , add a list item called swatch inside colors`, /needs at least one item/);
});
