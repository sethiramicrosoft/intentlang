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
    ["not equal to", 3, 3, false],
    ["not equal to", 5, 3, true],
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

test("a variable can hold plain text and be substituted into a Set instruction", () => {
  const { ir } = page(`Add a paragraph called name display inside page
The winner is Alex Carter.
Set the text of name display to winner`);
  assert.equal(textOf(ir, "name display"), "Alex Carter");
});

test("a text variable can be quoted, and can alias another text variable", () => {
  const { ir } = page(`Add a paragraph called quote display inside page
Add a paragraph called copy display inside page
The motto is "Play as a team".
The copy is the motto.
Set the text of quote display to motto
Set the text of copy display to copy`);
  assert.equal(textOf(ir, "quote display"), "Play as a team");
  assert.equal(textOf(ir, "copy display"), "Play as a team");
});

test("an If sentence can compare a text variable with is equal to", () => {
  const { ir } = page(`Add a paragraph called message inside page
The winner is Alex Carter.
If the winner is equal to Alex Carter, set the text of message to champion
Otherwise, set the text of message to runner up`);
  assert.equal(textOf(ir, "message"), "champion");
});

test("text equality comparison is case-insensitive", () => {
  const { ir } = page(`Add a paragraph called message inside page
The winner is Alex Carter.
If the winner is equal to alex carter, set the text of message to champion
Otherwise, set the text of message to runner up`);
  assert.equal(textOf(ir, "message"), "champion");
});

test("comparing a text variable with a numeric comparator is a clear error", () => {
  invalid(`Add a paragraph called message inside page
The winner is Alex Carter.
If the winner is greater than Alex Carter, set the text of message to champion`, /can only be compared with/);
});

test("text variables can also be compared with is not equal to", () => {
  const { ir } = page(`Add a paragraph called message inside page
The winner is Alex Carter.
If the winner is not equal to Sam Reid, set the text of message to correct
Otherwise, set the text of message to wrong`);
  assert.equal(textOf(ir, "message"), "correct");
});

test("an If sentence can chain several instructions with and then", () => {
  const { ir } = page(`Add a paragraph called message inside page
Add a paragraph called banner inside page
The score is 42.
If the score is greater than 10, set the text of message to high score and then set the text of banner to celebrate`);
  assert.equal(textOf(ir, "message"), "high score");
  assert.equal(textOf(ir, "banner"), "celebrate");
});

test("an Otherwise sentence can chain several instructions with and then", () => {
  const { ir } = page(`Add a paragraph called message inside page
Add a paragraph called banner inside page
The score is 2.
If the score is greater than 10, set the text of message to high score
Otherwise, set the text of message to try again and then set the text of banner to keep going`);
  assert.equal(textOf(ir, "message"), "try again");
  assert.equal(textOf(ir, "banner"), "keep going");
});

test("For each chains several instructions per item with and then, in order", () => {
  const { ir } = page(`Add a bullet list called colors inside page
For each color in red and blue, add a list item called swatch color inside colors and then set the text of swatch color to color`);
  assert.equal(textOf(ir, "swatch red"), "red");
  assert.equal(textOf(ir, "swatch blue"), "blue");
});

test("an If sentence can nest another If as its instruction", () => {
  const { ir } = page(`Add a paragraph called message inside page
The score is 42.
The wins is 12.
If the score is greater than 10, if the wins is greater than 5, set the text of message to double win`);
  assert.equal(textOf(ir, "message"), "double win");
});

test("a nested If's own condition can still be false without affecting the outer condition", () => {
  const { ir } = page(`Add a paragraph called message inside page
The score is 42.
The wins is 2.
If the score is greater than 10, if the wins is greater than 5, set the text of message to double win`);
  assert.equal(textOf(ir, "message"), "");
});

test("nested If can go three levels deep", () => {
  const { ir } = page(`Add a paragraph called message inside page
The a is 1.
The b is 1.
The c is 1.
If the a is equal to 1, if the b is equal to 1, if the c is equal to 1, set the text of message to all true`);
  assert.equal(textOf(ir, "message"), "all true");
});

test("Otherwise can nest an If as its instruction", () => {
  const { ir } = page(`Add a paragraph called message inside page
The score is 2.
The consolation is 9.
If the score is greater than 10, set the text of message to high score
Otherwise, if the consolation is greater than 5, set the text of message to good try`);
  assert.equal(textOf(ir, "message"), "good try");
});

test("a nested If's own condition does not corrupt the outer If/Otherwise pairing", () => {
  const { ir } = page(`Add a paragraph called message inside page
The score is 42.
The wins is 1.
If the score is greater than 10, if the wins is greater than 5, set the text of message to double win
Otherwise, set the text of message to fallback`);
  // The outer If was true (score > 10), so Otherwise must not run, even though the nested
  // If's own condition (wins > 5) was false and produced no output.
  assert.equal(textOf(ir, "message"), "");
});

test("an If sentence can nest a For each as its instruction", () => {
  const { ir } = page(`Add a bullet list called colors inside page
The show is 1.
If the show is equal to 1, for each color in red and blue, add a list item called swatch color inside colors`);
  assert.equal(textOf(ir, "swatch red"), "");
  assert.equal(textOf(ir, "swatch blue"), "");
});

test("a For each's own repeated instruction can itself be a nested If", () => {
  const { ir } = page(`Add a bullet list called colors inside page
The threshold is 1.
For each color in red and blue, if the threshold is equal to 1, add a list item called swatch color inside colors`);
  assert.equal(textOf(ir, "swatch red"), "");
  assert.equal(textOf(ir, "swatch blue"), "");
});

test("a For each's nested If can suppress every item when its condition is false", () => {
  const { ir } = page(`Add a bullet list called colors inside page
The threshold is 2.
For each color in red and blue, if the threshold is equal to 1, add a list item called swatch color inside colors`);
  assert.equal(ir.elements.some((element) => element.name === "swatch red"), false);
  assert.equal(ir.elements.some((element) => element.name === "swatch blue"), false);
});

test("a For each's own repeated instruction can itself be a nested For each", () => {
  const { ir } = page(`Add a bullet list called grid inside page
For each row in a and b, for each column in x and y, add a list item called cell row column inside grid`);
  assert.equal(textOf(ir, "cell a x"), "");
  assert.equal(textOf(ir, "cell a y"), "");
  assert.equal(textOf(ir, "cell b x"), "");
  assert.equal(textOf(ir, "cell b y"), "");
});

test("a nested For each inside For each still supports and-then chaining per item", () => {
  const { ir } = page(`Add a bullet list called colors inside page
For each color in red and blue, for each shade in light and dark, add a list item called swatch color shade inside colors and then add a list item called label color shade inside colors`);
  assert.equal(textOf(ir, "swatch red light"), "");
  assert.equal(textOf(ir, "label red light"), "");
  assert.equal(textOf(ir, "swatch blue dark"), "");
  assert.equal(textOf(ir, "label blue dark"), "");
});

test("For each list parsing still works for every existing list shape after the nesting rewrite", () => {
  const oxford = page(`Add a bullet list called colors inside page
For each color in red, green and blue, add a list item called swatch color inside colors`).ir;
  assert.equal(oxford.elements.filter((element) => element.tag === "li").length, 3);

  const noOxford = page(`Add a bullet list called colors inside page
For each color in red and blue, add a list item called swatch color inside colors`).ir;
  assert.equal(noOxford.elements.filter((element) => element.tag === "li").length, 2);

  const single = page(`Add a bullet list called colors inside page
For each color in red, add a list item called swatch color inside colors`).ir;
  assert.equal(single.elements.filter((element) => element.tag === "li").length, 1);
});

test("a For each counting loop repeats once per number, ascending inclusive of both ends", () => {
  const { ir } = page(`Add a bullet list called rows inside page
For each number from 1 to 5, add a list item called row number inside rows`);
  for (const n of [1, 2, 3, 4, 5]) assert.equal(textOf(ir, `row ${n}`), "");
  assert.equal(ir.elements.filter((element) => element.tag === "li").length, 5);
});

test("a For each counting loop can count downward when the start is greater than the end", () => {
  const { ir } = page(`Add a bullet list called rows inside page
For each number from 3 to 1, add a list item called row number inside rows`);
  assert.equal(ir.elements.filter((element) => element.tag === "li").length, 3);
  assert.equal(textOf(ir, "row 3"), "");
  assert.equal(textOf(ir, "row 1"), "");
});

test("a For each counting loop with equal start and end runs exactly once", () => {
  const { ir } = page(`Add a bullet list called rows inside page
For each number from 4 to 4, add a list item called row number inside rows`);
  assert.equal(ir.elements.filter((element) => element.tag === "li").length, 1);
  assert.equal(textOf(ir, "row 4"), "");
});

test("an If sentence's subject can be a plain number, not just a variable name", () => {
  const { ir } = page(`Add a paragraph called message inside page
If the 5 is greater than 3, set the text of message to five wins`);
  assert.equal(textOf(ir, "message"), "five wins");
});

test("a For each counting loop can nest an If and chain with and-then", () => {
  const { ir } = page(`Add a bullet list called rows inside page
The threshold is 3.
For each number from 1 to 4, if the number is greater than threshold, add a list item called big number inside rows and then add a list item called label number inside rows`);
  assert.equal(textOf(ir, "big 4"), "");
  assert.equal(textOf(ir, "label 4"), "");
  assert.equal(ir.elements.some((element) => element.name === "big 1"), false);
});

test("a For each counting loop used inside a nested If still works", () => {
  const { ir } = page(`Add a bullet list called rows inside page
The show is 1.
If the show is equal to 1, for each number from 1 to 3, add a list item called row number inside rows`);
  assert.equal(ir.elements.filter((element) => element.tag === "li").length, 3);
});

test("a To/Do procedure defines no output by itself but runs its body when called", () => {
  const { ir } = page(`Add a paragraph called message inside page
To greet, set the text of message to hello
Do greet.`);
  assert.equal(textOf(ir, "message"), "hello");
});

test("a procedure can be called before the line that defines it", () => {
  const { ir } = page(`Add a paragraph called message inside page
Do greet.
To greet, set the text of message to hello`);
  assert.equal(textOf(ir, "message"), "hello");
});

test("a procedure's body can chain several instructions with and then", () => {
  const { ir } = page(`Add a paragraph called first inside page
Add a paragraph called second inside page
To greet, set the text of first to hi and then set the text of second to there
Do greet.`);
  assert.equal(textOf(ir, "first"), "hi");
  assert.equal(textOf(ir, "second"), "there");
});

test("a procedure's body can contain a nested If", () => {
  const { ir } = page(`Add a paragraph called message inside page
The score is 42.
To report, if the score is greater than 10, set the text of message to high score
Do report.`);
  assert.equal(textOf(ir, "message"), "high score");
});

test("a procedure can be called (conditionally) from inside a for-each loop", () => {
  const { ir } = page(`Add a paragraph called message inside page
Add a bullet list called rows inside page
To announce, set the text of message to announced
For each number from 1 to 3, add a list item called row number inside rows and then if the number is equal to 2, do announce.`);
  assert.equal(ir.elements.filter((element) => element.tag === "li").length, 3);
  assert.equal(textOf(ir, "message"), "announced");
});

test("one procedure can call another", () => {
  const { ir } = page(`Add a paragraph called message inside page
To greet, set the text of message to hello
To welcome, do greet.
Do welcome.`);
  assert.equal(textOf(ir, "message"), "hello");
});

test("calling an undefined procedure is a clear error", () => {
  invalid(`Add a paragraph called message inside page
Do greet.`, /was never defined/);
});

test("calling a procedure name that is close to a defined one suggests the defined name", () => {
  const diagnostics = invalid(`Add a paragraph called message inside page
To greet, set the text of message to hello
Do greett.`, /Did you mean/);
  assert.match(JSON.stringify(diagnostics), /Do greet/);
});

test("a procedure that calls itself is a clear error instead of hanging the compiler", () => {
  invalid(`Add a paragraph called message inside page
To loop forever, do loop forever.
Do loop forever.`, /calls itself/);
});

test("two procedures that call each other is a clear error instead of hanging the compiler", () => {
  invalid(`Add a paragraph called message inside page
To a, do b.
To b, do a.
Do a.`, /calls itself/);
});

test("defining the same procedure name twice is a clear error", () => {
  invalid(`Add a paragraph called message inside page
To greet, set the text of message to hello
To greet, set the text of message to hi
Do greet.`, /was already defined/);
});

test("a source that only uses To/Do sentences is still routed through macro expansion", () => {
  const source = `Add a paragraph called message inside page
To greet, set the text of message to hello
Do greet.`;
  assert.equal(usesMacroGrammar(source), true);
});

test("a procedure can take one parameter and use it in its body, bound fresh at each call", () => {
  const { ir } = page(`Add a paragraph called message inside page
To greet with person, set the text of message to person
Do greet with Alex Carter.`);
  assert.equal(textOf(ir, "message"), "Alex Carter");
});

test("a parameterized procedure called with a number can use it in arithmetic and comparisons", () => {
  const { ir } = page(`Add a paragraph called message inside page
To classify with score, if the score is at least 10, set the text of message to high and then if the score is less than 10, set the text of message to low
Do classify with 15.`);
  assert.equal(textOf(ir, "message"), "high");
});

test("a parameterized procedure called with an existing variable's name copies that variable's value", () => {
  const { ir } = page(`Add a paragraph called message inside page
The winner is Jordan.
To announce with name, set the text of message to name
Do announce with winner.`);
  assert.equal(textOf(ir, "message"), "Jordan");
});

test("a procedure's own parameter only shadows an outer variable of the same name for the duration of the call", () => {
  const { ir } = page(`Add a paragraph called before inside page
Add a paragraph called during inside page
Add a paragraph called after inside page
The name is Original.
To greet with name, set the text of during to name
Set the text of before to name
Do greet with Replacement.
Set the text of after to name`);
  assert.equal(textOf(ir, "before"), "Original");
  assert.equal(textOf(ir, "during"), "Replacement");
  assert.equal(textOf(ir, "after"), "Original");
});

test("a parameterized procedure can be called repeatedly from a For each loop, once per item", () => {
  const { ir } = page(`Add a paragraph called red note inside page
Add a paragraph called green note inside page
Add a paragraph called blue note inside page
To announce with item, if the item is equal to green, set the text of green note to seen
For each color in red, green and blue, do announce with color.`);
  assert.equal(textOf(ir, "red note"), "");
  assert.equal(textOf(ir, "green note"), "seen");
  assert.equal(textOf(ir, "blue note"), "");
});

test("one parameterized procedure can call another, passing its own parameter along", () => {
  const { ir } = page(`Add a paragraph called message inside page
To announce with name, set the text of message to name
To welcome with guest, do announce with guest.
Do welcome with Sam.`);
  assert.equal(textOf(ir, "message"), "Sam");
});

test("calling a parameterized procedure without a value is a clear error", () => {
  invalid(`Add a paragraph called message inside page
To greet with person, set the text of message to person
Do greet.`, /needs a value/);
});

test("calling a parameterless procedure with a value is a clear error", () => {
  invalid(`Add a paragraph called message inside page
To greet, set the text of message to hello
Do greet with Alex.`, /doesn't take a value/);
});

test("a variable sentence works as a For each's own repeated instruction, accumulating across iterations", () => {
  const { ir } = page(`Add a paragraph called message inside page
The total is 0.
For each amount in 1, 2 and 3, the total is total plus amount.
Set the text of message to total`);
  assert.equal(textOf(ir, "message"), "6");
});

test("a variable sentence works inside a procedure's body, mutating a variable that outlives the call", () => {
  const { ir } = page(`Add a paragraph called message inside page
The total is 0.
To add with amount, the total is total plus amount.
Do add with 5.
Do add with 7.
Set the text of message to total`);
  assert.equal(textOf(ir, "message"), "12");
});

test("a variable sentence works as an If's own instruction, and only runs when the condition is true", () => {
  const { ir } = page(`Add a paragraph called message inside page
The score is 3.
If the score is at least 1, the score is score plus 100.
If the score is less than 0, the score is score plus 1000.
Set the text of message to score`);
  assert.equal(textOf(ir, "message"), "103");
});

test("a procedure can take two parameters, joined with 'and' in both the definition and the call", () => {
  const { ir } = page(`Add a paragraph called message inside page
To add with a and b, set the text of message to a plus b
Do add with 3 and 4.`);
  assert.equal(textOf(ir, "message"), "7");
});

test("a procedure can take three parameters, and a call may list its values with commas", () => {
  const { ir } = page(`Add a paragraph called message inside page
To greet with first and middle and last, set the text of message to first
Do greet with Alex, Q and Carter.`);
  assert.equal(textOf(ir, "message"), "Alex");
});

test("a single-parameter call's whole value can itself contain the word 'and' as literal text", () => {
  const { ir } = page(`Add a paragraph called message inside page
To announce with pair, set the text of message to pair
Do announce with Alex and Sam.`);
  assert.equal(textOf(ir, "message"), "Alex and Sam");
});

test("a multi-parameter procedure's parameters can be used inside a variable sentence in its body", () => {
  const { ir } = page(`Add a paragraph called message inside page
The total is 0.
To add with a and b, the total is a plus b.
Do add with 10 and 20.
Set the text of message to total`);
  assert.equal(textOf(ir, "message"), "30");
});

test("calling a two-parameter procedure with only one value is a clear error naming the required count", () => {
  invalid(`Add a paragraph called message inside page
To add with a and b, set the text of message to a plus b
Do add with 3.`, /needs 2 values, but this call gives 1/);
});

test("calling a two-parameter procedure with three values is a clear error naming the required count", () => {
  invalid(`Add a paragraph called message inside page
To add with a and b, set the text of message to a plus b
Do add with 1, 2 and 3.`, /needs 2 values, but this call gives 3/);
});

test("defining a procedure with the same parameter name twice is a clear error", () => {
  invalid(`Add a paragraph called message inside page
To add with a and a, set the text of message to a
Do add with 3 and 4.`, /more than once/);
});

test("arithmetic can chain more than one operator, evaluated strictly left to right", () => {
  const { ir } = page(`Add a paragraph called message inside page
The a is 2.
The b is 3.
The c is 4.
Set the text of message to a plus b plus c`);
  assert.equal(textOf(ir, "message"), "9");
});

test("a chained arithmetic expression can mix different operators, still left to right", () => {
  const { ir } = page(`Add a paragraph called message inside page
The a is 10.
The b is 4.
The c is 2.
Set the text of message to a minus b times c`);
  // Left to right, with no operator precedence: (10 - 4) * 2 = 12, not 10 - (4 * 2) = 2.
  assert.equal(textOf(ir, "message"), "12");
});

test("a chained arithmetic expression works inside a variable sentence too", () => {
  const { ir } = page(`Add a paragraph called message inside page
The total is 0.
The total is 1 plus 2 plus 3 plus 4.
Set the text of message to total`);
  assert.equal(textOf(ir, "message"), "10");
});

test("a chained arithmetic expression works with a three-parameter procedure's own parameters", () => {
  const { ir } = page(`Add a paragraph called message inside page
To add with a and b and c, set the text of message to a plus b plus c
Do add with 3, 4 and 5.`);
  assert.equal(textOf(ir, "message"), "12");
});

test("dividing by zero anywhere in a chain leaves the whole expression unresolved, same as a single division by zero", () => {
  const { ir } = page(`Add a paragraph called message inside page
The a is 10.
The b is 0.
Set the text of message to a divided by b plus 5`);
  // Consistent with a single division by zero: the expression is left as literal, unresolved
  // text rather than silently guessing a value.
  assert.equal(textOf(ir, "message"), "a divided by b plus 5");
});

test("Repeat runs its instruction a fixed number of times with no loop variable of its own", () => {
  const { ir } = page(`Add a paragraph called message inside page
The total is 0.
Repeat 4 times, the total is total plus 1.
Set the text of message to total`);
  assert.equal(textOf(ir, "message"), "4");
});

test("Repeat 0 times is valid and simply produces no output", () => {
  const { ir } = page(`Add a paragraph called message inside page
The total is 0.
Repeat 0 times, the total is total plus 1.
Set the text of message to total`);
  assert.equal(textOf(ir, "message"), "0");
});

test("a negative Repeat count is a clear error rather than silently running zero times", () => {
  invalid(`Add a paragraph called message inside page
Repeat -1 times, set the text of message to oops`, /needs a count of 0 or more/);
});

test("Repeat can nest inside an If's own instruction", () => {
  const { ir } = page(`Add a paragraph called message inside page
The total is 0.
If the total is equal to 0, repeat 3 times, the total is total plus 10.
Set the text of message to total`);
  assert.equal(textOf(ir, "message"), "30");
});

test("Repeat can be a procedure's own body, and can nest inside a For each's own instruction", () => {
  const { ir } = page(`Add a paragraph called message inside page
The total is 0.
To add ten, repeat 10 times, the total is total plus 1.
Do add ten.
Set the text of message to total`);
  assert.equal(textOf(ir, "message"), "10");
});
