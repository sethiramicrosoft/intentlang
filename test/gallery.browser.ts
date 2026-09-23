import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { compileEnglishSource } from "../src/english.js";

test("published gallery HTML matches its English source and opens without a server", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const name of ["last-signal", "matchday", "words-in-motion", "season-scoreboard"]) {
      const source = await readFile(`examples/${name}.visual.intent`, "utf8");
      const result = compileEnglishSource(source);
      if (!result.ok) assert.fail(JSON.stringify(result.diagnostics));
      const html = await readFile(`examples/${name}.html`, "utf8");
      assert.equal(html.replaceAll("\r\n", "\n"), result.html, `${name} output must be regenerated`);
      await page.goto(pathToFileURL(resolve(`examples/${name}.html`)).href);
      assert.equal(await page.locator("script").count(), 0);
      assert.equal(await page.locator("body").evaluate((element) =>
        getComputedStyle(element).fontFamily.includes("system-ui")), true);
    }
    await page.goto(pathToFileURL(resolve("examples/season-scoreboard.html")).href);
    assert.equal(await page.getByText("48", { exact: true }).isVisible(), true);
    assert.equal(await page.getByText("Promotion form. Keep it up", { exact: true }).isVisible(), true);
    assert.equal(await page.getByText("Played Dunwell Rovers", { exact: true }).isVisible(), true);
    await page.goto(pathToFileURL(resolve("examples/matchday.html")).href);
    for (const viewport of [
      { width: 1440, height: 1100 }, { width: 768, height: 1024 }, { width: 390, height: 844 }
    ]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.getByRole("button", { name: "Match briefing", exact: true }).click();
      assert.equal(await page.getByText("Saturday: the three reminders", { exact: true }).isVisible(), true);
      await page.getByRole("button", { name: "Got it", exact: true }).click();
      assert.equal(await page.locator(":popover-open").count(), 0);
    }
    await page.getByLabel("Training theme", { exact: true }).selectOption({ label: "Finishing in transition" });
    await page.getByLabel("Training intensity", { exact: true }).fill("8");
    await page.getByLabel("Coach notes", { exact: true }).fill("Focus on the first pass.");
    await page.getByLabel("Pitch safety check", { exact: true }).check();
    assert.equal(await page.getByLabel("Training intensity", { exact: true }).inputValue(), "8");
    await page.getByRole("button", { name: "Reset my changes", exact: true }).click();
    assert.equal(await page.getByLabel("Training theme", { exact: true }).inputValue(), "Counter-pressing");
    assert.equal(await page.getByLabel("Training intensity", { exact: true }).inputValue(), "6");
    assert.equal(await page.getByLabel("Coach notes", { exact: true }).inputValue(), "");
    assert.equal(await page.getByLabel("Pitch safety check", { exact: true }).isChecked(), false);
    assert.equal(await page.getByLabel("Balls, bibs and cones", { exact: true }).isChecked(), true);
    await page.getByText("01   ARRIVE + ACTIVATE   /   15 min", { exact: true }).click();
    assert.equal(await page.getByText("Open your body before the ball arrives.", { exact: true }).isVisible(), true);
    await page.getByRole("link", { name: "Drill library", exact: true }).click();
    assert.ok(new URL(page.url()).hash);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
