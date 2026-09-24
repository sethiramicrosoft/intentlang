import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { startStudio } from "../src/studio-server.js";
import { compilePageSource } from "../src/web.js";
import { elementExample, webElements } from "../src/web-catalogue.js";

test("page playground builds real HTML, discovers capabilities and exports native controls", async () => {
  const dir = await mkdtemp(join(tmpdir(), "intentlang-web-browser-"));
  const studio = await startStudio({ sourcePath: resolve("examples/todo.intent"), port: 3352, noOpen: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto(studio.url + "/playground");
    const ready = () => page.locator("#status").filter({ hasText: "Ready." }).waitFor();
    await ready();
    const preview = () => page.frameLocator("#preview");
    async function run(source: string) {
      await page.locator("#source").fill(source);
      await page.locator("#run").click();
      await ready();
    }

    await page.locator("#lesson").selectOption("webpage");
    await ready();
    assert.equal(await preview().locator("h1").textContent(), "Built with English");
    assert.equal(await preview().locator("ul > li").count(), 2);
    assert.deepEqual(await preview().locator("section").evaluate((element) => ({
      padding: getComputedStyle(element).padding,
      radius: getComputedStyle(element).borderRadius,
      border: getComputedStyle(element).borderTopWidth
    })), { padding: "24px", radius: "24px", border: "2px" });
    assert.equal(await preview().locator("details p").isVisible(), false);
    await preview().locator("summary").click();
    assert.equal(await preview().locator("details p").isVisible(), true);
    assert.equal(await preview().locator("progress").evaluate((element: HTMLProgressElement) => element.value), 70);
    assert.equal(await preview().locator("script").count(), 0);

    for (const viewport of [{ width: 1280, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await preview().locator("body").evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.locator("#lesson").selectOption("controls");
    await ready();
    const email = preview().getByLabel("Email address", { exact: true });
    assert.equal(await email.evaluate((element: HTMLInputElement) => element.checkValidity()), false);
    await email.fill("person@example.com");
    assert.equal(await email.evaluate((element: HTMLInputElement) => element.checkValidity()), true);
    await preview().getByLabel("Choose a color").selectOption("green");
    assert.equal(await preview().getByLabel("Choose a color").inputValue(), "green");
    await preview().getByText("I can interact with real controls").click();
    assert.equal(await preview().locator('input[type="checkbox"]').isChecked(), true);

    const downloadEvent = page.waitForEvent("download");
    await page.locator("#download").click();
    const download = await downloadEvent;
    const output = join(dir, "native-controls.html");
    await download.saveAs(output);
    const standalone = await browser.newPage();
    await standalone.goto(pathToFileURL(output).href);
    await standalone.getByLabel("Email address", { exact: true }).fill("offline@example.com");
    await standalone.getByText("I can interact with real controls").click();
    assert.equal(await standalone.locator('input[type="checkbox"]').isChecked(), true);
    assert.doesNotMatch(await readFile(output, "utf8"), /<script/);
    await standalone.close();

    await page.locator("#lesson").selectOption("table");
    await ready();
    assert.equal(await preview().locator("table caption").textContent(), "A table written in English");
    assert.equal(await preview().locator("table tbody tr td").count(), 2);

    await run("Add a paragraph called greeting\nSet the text of greeting to Hello world");
    await page.locator("#capabilities > summary").click();
    await page.locator("#catalogue-status").filter({ hasText: "96 element types" }).waitFor();
    await page.locator("#capability-kind").selectOption("styles");
    await page.locator("#capability-target").selectOption("greeting");
    await page.locator("#capability-search").fill("letter spacing");
    await page.locator("#capability-value").fill("3 pixels");
    await page.locator("#capability-results").getByRole("button", { name: "Insert instructions" }).click();
    await ready();
    assert.equal(await preview().locator("p").evaluate((element) => getComputedStyle(element).letterSpacing), "3px");
    assert.match(await page.locator("#source").inputValue(), /Set the style letter spacing of greeting to 3 pixels/);

    await page.locator("#capability-kind").selectOption("elements");
    await page.locator("#capability-search").fill("table cell");
    await page.locator("#capability-results").getByRole("button", { name: "Insert instructions" }).click();
    await ready();
    assert.equal(await preview().locator("table tbody tr td").count(), 1);
    await page.locator("#capability-search").fill("sample output");
    await page.locator("#capability-results").getByRole("button", { name: "Insert instructions" }).click();
    await ready();
    assert.equal(await preview().locator("samp").count(), 1);
    await page.locator("#capability-search").fill("iframe");
    assert.match(await page.locator("#capability-results").textContent() ?? "", /restricted/);
    assert.equal(await page.locator("#capability-results button").count(), 0);

    await page.locator("#source").fill("Add an image called portrait\nSet the width of portrait to 120");
    await page.locator("#run").click();
    await page.locator("#status").filter({ hasText: "Ambiguous instructions" }).waitFor();
    assert.equal(await page.locator("#download").isDisabled(), true);
    await page.getByRole("button", { name: /^Set attribute width/ }).click();
    await ready();
    assert.equal(await preview().locator("img").getAttribute("width"), "120");

    await page.locator("#source").fill("Add a section called welcome\nAdd a script called program");
    await page.locator("#run").click();
    await page.locator("#problems").filter({ hasText: "restricted" }).waitFor();
    assert.equal(await page.locator("#preview").isVisible(), false);
    assert.equal(await page.locator("#download").isDisabled(), true);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await studio.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("a compiled When-clicked page runs its own hash-pinned script live in a real browser", async () => {
  const compiled = compilePageSource(`Add a paragraph called counter
Set the text of counter to 0
Add a button called increment
Set the text of increment to Add one
When the increment is clicked, add 1 to the text of counter`);
  if (!compiled.ok) assert.fail(JSON.stringify(compiled.diagnostics));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.setContent(compiled.html);
    assert.equal(await page.locator("#element-1").textContent(), "0");
    await page.locator("#element-2").click();
    await page.locator("#element-2").click();
    assert.equal(await page.locator("#element-1").textContent(), "2");
    assert.deepEqual(errors, []); // no CSP violation, no runtime error
  } finally { await browser.close(); }
});

test("When the page loads runs its instructions immediately in a real browser, ahead of any click", async () => {
  const compiled = compilePageSource(`Add a paragraph called greeting
Set the text of greeting to loading...
Add a button called go
Set the text of go to Go
When the page loads, set the text of greeting to Welcome!
When the go is clicked, set the text of greeting to Clicked!`);
  if (!compiled.ok) assert.fail(JSON.stringify(compiled.diagnostics));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.setContent(compiled.html);
    // The page-load instruction has already run by the time content settles, with no click.
    assert.equal(await page.locator("#element-1").textContent(), "Welcome!");
    await page.locator("#element-2").click();
    assert.equal(await page.locator("#element-1").textContent(), "Clicked!");
    assert.deepEqual(errors, []); // no CSP violation, no runtime error
  } finally { await browser.close(); }
});

test("a click can read what a visitor actually typed into a real text input", async () => {
  const compiled = compilePageSource(`Add a text input called name field
Add a paragraph called greeting
Add a button called submit
Set the text of submit to Say hello
When the submit is clicked, set the text of greeting to the value of name field`);
  if (!compiled.ok) assert.fail(JSON.stringify(compiled.diagnostics));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.setContent(compiled.html);
    await page.locator("#element-1").fill("Ada Lovelace");
    await page.locator("#element-3").click();
    assert.equal(await page.locator("#element-2").textContent(), "Ada Lovelace");
    assert.deepEqual(errors, []); // no CSP violation, no runtime error
  } finally { await browser.close(); }
});

test("a click can set a target's text to a real random number in a live browser, within the requested range", async () => {
  const compiled = compilePageSource(`Add a paragraph called roll
Add a button called dice
Set the text of dice to Roll
When the dice is clicked, set the text of roll to a random number from 1 to 6`);
  if (!compiled.ok) assert.fail(JSON.stringify(compiled.diagnostics));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.setContent(compiled.html);
    const seen = new Set<number>();
    for (let i = 0; i < 20; i++) {
      await page.locator("#element-2").click();
      seen.add(Number(await page.locator("#element-1").textContent()));
    }
    for (const value of seen) assert.ok(value >= 1 && value <= 6, `${value} was outside 1-6`);
    assert.ok(seen.size > 1, "expected at least some variety across 20 rolls");
    assert.deepEqual(errors, []); // no CSP violation, no runtime error
  } finally { await browser.close(); }
});

test("a click can add or subtract a live input's value into a running total in a real browser", async () => {
  const compiled = compilePageSource(`Add a text input called amount field
Add a paragraph called total
Set the text of total to 10
Add a button called add
Set the text of add to Add
Add a button called subtract
Set the text of subtract to Subtract
When the add is clicked, add the value of amount field to the text of total
When the subtract is clicked, subtract the value of amount field from the text of total`);
  if (!compiled.ok) assert.fail(JSON.stringify(compiled.diagnostics));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.setContent(compiled.html);
    await page.locator("#element-1").fill("5");
    await page.locator("#element-3").click(); // add button
    assert.equal(await page.locator("#element-2").textContent(), "15");
    await page.locator("#element-1").fill("3");
    await page.locator("#element-4").click(); // subtract button
    assert.equal(await page.locator("#element-2").textContent(), "12");
    assert.deepEqual(errors, []); // no CSP violation, no runtime error
  } finally { await browser.close(); }
});

test("a click can multiply or divide a running total by a fixed number in a real browser", async () => {
  const compiled = compilePageSource(`Add a paragraph called total
Set the text of total to 5
Add a button called double
Set the text of double to Double
Add a button called halve
Set the text of halve to Halve
When the double is clicked, multiply the text of total by 2
When the halve is clicked, divide the text of total by 2`);
  if (!compiled.ok) assert.fail(JSON.stringify(compiled.diagnostics));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.setContent(compiled.html);
    await page.locator("#element-2").click(); // double: 5 -> 10
    assert.equal(await page.locator("#element-1").textContent(), "10");
    await page.locator("#element-3").click(); // halve: 10 -> 5
    assert.equal(await page.locator("#element-1").textContent(), "5");
    assert.deepEqual(errors, []); // no CSP violation, no runtime error
  } finally { await browser.close(); }
});

test("a click can run a real runtime if-conditional over a live input's value in a real browser", async () => {
  const compiled = compilePageSource(`Add a text input called score field
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of score field is greater than 50, set the text of result to high and then if the value of score field is at most 50, set the text of result to low`);
  if (!compiled.ok) assert.fail(JSON.stringify(compiled.diagnostics));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.setContent(compiled.html);
    await page.locator("#element-1").fill("90");
    await page.locator("#element-3").click();
    assert.equal(await page.locator("#element-2").textContent(), "high");
    await page.locator("#element-1").fill("10");
    await page.locator("#element-3").click();
    assert.equal(await page.locator("#element-2").textContent(), "low");
    assert.deepEqual(errors, []); // no CSP violation, no runtime error
  } finally { await browser.close(); }
});

test("a click's if-conditional otherwise (else) branch fires in a real browser exactly when the condition is false", async () => {
  const compiled = compilePageSource(`Add a text input called score field
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of score field is greater than 50, set the text of result to high otherwise set the text of result to low`);
  if (!compiled.ok) assert.fail(JSON.stringify(compiled.diagnostics));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.setContent(compiled.html);
    await page.locator("#element-1").fill("90");
    await page.locator("#element-3").click();
    assert.equal(await page.locator("#element-2").textContent(), "high");
    await page.locator("#element-1").fill("10");
    await page.locator("#element-3").click();
    assert.equal(await page.locator("#element-2").textContent(), "low");
    assert.deepEqual(errors, []); // no CSP violation, no runtime error
  } finally { await browser.close(); }
});

test("a click's if-conditional can compare two live inputs against each other in a real browser", async () => {
  const compiled = compilePageSource(`Add a text input called a
Add a text input called b
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of a is greater than the value of b, set the text of result to a wins otherwise set the text of result to b wins`);
  if (!compiled.ok) assert.fail(JSON.stringify(compiled.diagnostics));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.setContent(compiled.html);
    await page.locator("#element-1").fill("10");
    await page.locator("#element-2").fill("3");
    await page.locator("#element-4").click();
    assert.equal(await page.locator("#element-3").textContent(), "a wins");
    await page.locator("#element-1").fill("1");
    await page.locator("#element-2").fill("9");
    await page.locator("#element-4").click();
    assert.equal(await page.locator("#element-3").textContent(), "b wins");
    assert.deepEqual(errors, []); // no CSP violation, no runtime error
  } finally { await browser.close(); }
});

test("a click's if-conditional can compare live text with is/contains/starts with/ends with in a real browser", async () => {
  const compiled = compilePageSource(`Add a text input called message
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of message contains urgent, set the text of result to flagged otherwise set the text of result to normal`);
  if (!compiled.ok) assert.fail(JSON.stringify(compiled.diagnostics));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.setContent(compiled.html);
    await page.locator("#element-1").fill("this is urgent, please read");
    await page.locator("#element-3").click();
    assert.equal(await page.locator("#element-2").textContent(), "flagged");
    await page.locator("#element-1").fill("nothing to see here");
    await page.locator("#element-3").click();
    assert.equal(await page.locator("#element-2").textContent(), "normal");
    assert.deepEqual(errors, []); // no CSP violation, no runtime error
  } finally { await browser.close(); }
});

test("a click can set/clear a real input's value, including copying another live input's value, in a real browser", async () => {
  const compiled = compilePageSource(`Add a text input called message
Add a paragraph called result
Set the text of result to none
Add a button called send
Set the text of send to Send
When the send is clicked, set the text of result to the value of message and then clear the value of message`);
  if (!compiled.ok) assert.fail(JSON.stringify(compiled.diagnostics));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.setContent(compiled.html);
    await page.locator("#element-1").fill("hello there");
    await page.locator("#element-3").click();
    assert.equal(await page.locator("#element-2").textContent(), "hello there");
    assert.equal(await page.locator("#element-1").inputValue(), "");
    assert.deepEqual(errors, []); // no CSP violation, no runtime error
  } finally { await browser.close(); }
});

test("a click can check/uncheck a real checkbox and branch on its checked state in a real browser", async () => {
  const compiled = compilePageSource(`Add a checkbox called agree
Add a paragraph called result
Set the text of result to none
Add a button called submit
Set the text of submit to Submit
Add a button called turn on
Set the text of turn on to Turn on
When the submit is clicked, if agree is checked, set the text of result to yes otherwise set the text of result to no
When the turn on is clicked, check agree`);
  if (!compiled.ok) assert.fail(JSON.stringify(compiled.diagnostics));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.setContent(compiled.html);
    await page.locator("#element-3").click(); // submit, unchecked
    assert.equal(await page.locator("#element-2").textContent(), "no");
    await page.locator("#element-1").check(); // a real user click on the checkbox itself
    await page.locator("#element-3").click(); // submit, now checked
    assert.equal(await page.locator("#element-2").textContent(), "yes");
    await page.locator("#element-1").uncheck();
    await page.locator("#element-4").click(); // "check agree" instruction, driven by JS
    assert.equal(await page.locator("#element-1").isChecked(), true);
    assert.deepEqual(errors, []); // no CSP violation, no runtime error
  } finally { await browser.close(); }
});

test("a click can hide, show or toggle the visibility of a real element in a real browser", async () => {
  const compiled = compilePageSource(`Add a paragraph called details
Set the text of details to Secret info
Add a button called hide it
Set the text of hide it to Hide
Add a button called show it
Set the text of show it to Show
Add a button called toggle
Set the text of toggle to Toggle
When the hide it is clicked, hide details
When the show it is clicked, show details
When the toggle is clicked, toggle the visibility of details`);
  if (!compiled.ok) assert.fail(JSON.stringify(compiled.diagnostics));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.setContent(compiled.html);
    assert.equal(await page.locator("#element-1").isVisible(), true);
    await page.locator("#element-2").click(); // "hide it"
    assert.equal(await page.locator("#element-1").isHidden(), true);
    await page.locator("#element-3").click(); // "show it"
    assert.equal(await page.locator("#element-1").isVisible(), true);
    await page.locator("#element-4").click(); // "toggle", was visible, becomes hidden
    assert.equal(await page.locator("#element-1").isHidden(), true);
    await page.locator("#element-4").click(); // "toggle" again, becomes visible again
    assert.equal(await page.locator("#element-1").isVisible(), true);
    assert.deepEqual(errors, []); // no CSP violation, no runtime error
  } finally { await browser.close(); }
});

test("When the <field> changes fires on a real dropdown selection or a committed text edit, in a real browser", async () => {
  const compiled = compilePageSource(`Add a dropdown called favorite color
Add an option called red inside favorite color
Add an option called blue inside favorite color
Set the text of red to Red
Set the text of blue to Blue
Add a paragraph called result
Set the text of result to none
Add a text input called name field
Add a paragraph called echo
Set the text of echo to none
When the favorite color changes, set the text of result to the value of favorite color
When the name field changes, set the text of echo to the value of name field`);
  if (!compiled.ok) assert.fail(JSON.stringify(compiled.diagnostics));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.setContent(compiled.html);
    await page.locator("#element-1").selectOption("Blue");
    assert.equal(await page.locator("#element-4").textContent(), "Blue");
    await page.locator("#element-5").fill("Ada");
    await page.locator("#element-5").dispatchEvent("change"); // fill() alone doesn't fire "change"
    assert.equal(await page.locator("#element-6").textContent(), "Ada");
    assert.deepEqual(errors, []); // no CSP violation, no runtime error
  } finally { await browser.close(); }
});

test("a click can repeat an instruction the correct number of times, including nested repeats, in a real browser", async () => {
  const compiled = compilePageSource(`Add a paragraph called counter
Set the text of counter to 0
Add a button called go
Set the text of go to Go
When the go is clicked, repeat 3 times, add 1 to the text of counter and then repeat 2 times, repeat 4 times, add 1 to the text of counter`);
  if (!compiled.ok) assert.fail(JSON.stringify(compiled.diagnostics));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.setContent(compiled.html);
    await page.locator("#element-2").click();
    // 3 (first repeat) + 2*4 (nested repeat) = 11, proving the nested loop's own counter
    // doesn't stomp the outer loop's, and both loops actually ran the right number of times.
    assert.equal(await page.locator("#element-1").textContent(), "11");
    assert.deepEqual(errors, []); // no CSP violation, no runtime error
  } finally { await browser.close(); }
});

test("all advertised element types survive real browser parsing with their requested parentage", async () => {
  const source = webElements.filter((element) => element.status === "available")
    .map((element) => elementExample(element).replace(/\b(called|inside) sample /g, `$1 sample ${element.name} `)).join("\n");
  const compiled = compilePageSource(source);
  if (!compiled.ok) assert.fail(JSON.stringify(compiled.diagnostics));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(compiled.html);
    const actual = await page.locator("[id]").evaluateAll((elements) =>
      elements.map((element) => ({
        id: element.id, tag: element.tagName.toLowerCase(),
        parent: element.parentElement?.closest("[id]")?.id ?? ""
      })));
    assert.deepEqual(actual, compiled.ir.elements.map((element) => ({
      id: element.id, tag: element.tag, parent: element.parent
    })));
  } finally { await browser.close(); }
});
