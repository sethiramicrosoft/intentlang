import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { startStudio } from "../src/studio-server.js";

test("Studio editor autocompletes instruction snippets and declared names", async () => {
  const studio = await startStudio({ sourcePath: resolve("examples/focus-board.intent"), port: 3353, noOpen: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(studio.url);
    await page.locator("#btn-existing-open-advanced").click();
    await page.locator("#tab-mode-code").click();
    const editor = page.locator("#editor");
    await editor.waitFor({ state: "visible" });
    await editor.fill("");

    await page.keyboard.type("Add a but", { delay: 5 });
    await page.locator(".completion-popup").waitFor({ state: "visible" });
    assert.deepEqual(await page.locator(".completion-item").allTextContents(), ["Add a button called snippet"]);
    await page.keyboard.press("Tab");
    assert.equal(await editor.inputValue(), "Add a button called ");

    await editor.fill("");
    await page.keyboard.type(
      "Add a button called add task\nSet the text of add task to Add task\nWhen the add",
      { delay: 2 }
    );
    await page.locator(".completion-popup").waitFor({ state: "visible" });
    assert.deepEqual(await page.locator(".completion-item").allTextContents(), ["add taskname"]);
    await page.keyboard.press("Tab");
    assert.equal(
      await editor.inputValue(),
      "Add a button called add task\nSet the text of add task to Add task\nWhen the add task"
    );
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await studio.close();
  }
});
