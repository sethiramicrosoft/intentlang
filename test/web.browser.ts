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
