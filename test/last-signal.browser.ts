import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { compileEnglishSource } from "../src/english.js";

test("Last Signal's English source plays all three endings across viewport sizes", async () => {
  const source = await readFile("examples/last-signal.visual.intent", "utf8");
  const result = compileEnglishSource(source);
  if (!result.ok) assert.fail(JSON.stringify(result.diagnostics));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setContent(result.html);
    const click = (name: string) => page.getByRole("button", { name, exact: true }).click();
    for (const viewport of [
      { width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 390, height: 844 }
    ]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await click("BEGIN TRANSMISSION");
      await click("Follow the voice");
      await click("Connect the relay");
      assert.equal(await page.getByText("You brought the signal home.", { exact: true }).isVisible(), true);
      await click("Reconsider the relay");
      await click("Isolate the relay first");
      await click("Bring the survivor home");
      assert.equal(await page.getByText("One life is not a small thing.", { exact: true }).isVisible(), true);
      await click("Make a different choice");
      await click("Preserve the crew archive");
      assert.equal(await page.getByText("The truth has a weight.", { exact: true }).isVisible(), true);
      const box = await page.getByRole("region", { name: "The witness ending", exact: true }).boundingBox();
      assert.ok(box && box.x >= 0 && box.y >= 0 &&
        box.x + box.width <= viewport.width && box.y + box.height <= viewport.height);
      await click("Reconsider the archive");
      assert.equal(await page.getByRole("button", { name: "Bring the survivor home", exact: true }).isVisible(), true);
      let depth = await page.locator(":popover-open").count();
      while (depth > 0) {
        await page.keyboard.press("Escape");
        const next = await page.locator(":popover-open").count();
        assert.ok(next < depth, "Escape must close the current scene");
        depth = next;
      }
      await click("BEGIN TRANSMISSION");
      await click("Investigate the amber beacon");
      await click("Bring the survivor home");
      assert.equal(await page.getByText("One life is not a small thing.", { exact: true }).isVisible(), true);
      for (let remaining = await page.locator(":popover-open").count(); remaining > 0; remaining--) {
        await page.keyboard.press("Escape");
      }
      assert.equal(await page.locator(":popover-open").count(), 0);
    }
    const archive = page.getByText("OPTIONAL INTELLIGENCE / Open the recovered maintenance log", { exact: true });
    await archive.click();
    assert.equal(await page.getByText(/ENGINEER'S LOG:/).isVisible(), true);
    assert.equal(await page.locator("script").count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
