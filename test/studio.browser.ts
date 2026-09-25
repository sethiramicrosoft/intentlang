import assert from "node:assert/strict";
import test from "node:test";
import { join, resolve } from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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
    await page.locator("#nav-code").waitFor();
    assert.equal(await page.locator("#nav-code").getAttribute("aria-pressed"), "true");
    await page.locator("#btn-help").click();
    await page.getByRole("dialog", { name: "IntentLang Studio help center" }).waitFor({ state: "visible" });
    await page.locator("#help-search").fill("autocomplete");
    await page.locator("#help-search-status").filter({ hasText: "topics match" }).waitFor();
    assert.ok(await page.locator("#help-code").isVisible());
    assert.equal(await page.locator("#help-builder").isVisible(), false);
    await page.locator("#btn-help-clear").click();
    assert.ok(await page.locator("#help-builder").isVisible());
    await page.locator("#btn-help-close").click();
    await page.locator("#tab-mode-code").click();
    const editor = page.locator("#editor");
    await editor.waitFor({ state: "visible" });
    await editor.fill("");

    await page.keyboard.type("app", { delay: 5 });
    await page.locator(".completion-popup").waitFor({ state: "visible" });
    assert.equal(await page.locator(".completion-item").first().textContent(), "application + entity + action startersnippet");
    await page.keyboard.press("Tab");
    assert.equal(
      await editor.inputValue(),
      'application TaskBoard\n\na Task has a required title as text length between 1 and 200\na Task has a status as text default "open"\n\naction close a Task\n  require status is not "closed" otherwise "Task is already closed"\n  set status to "closed"'
    );
    await page.locator("#panel-problems").filter({ hasText: "No problems detected." }).waitFor();

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

test("Studio clarification review persists confirmation before applying source", async () => {
  const directory = await mkdtemp(join(tmpdir(), "intentlang-review-"));
  const sourcePath = join(directory, "review.intent");
  await writeFile(sourcePath, "", "utf8");
  const studio = await startStudio({ sourcePath, port: 3354, noOpen: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
    await page.goto(studio.url);
    await page.locator("#nav-code").click();
    await page.locator("#tab-mode-describe").click();
    await page
      .locator("#describe-textarea")
      .fill("Build an app with name and department.");
    await page.locator("#btn-interpret-offline").click();
    await page
      .locator(".describe-question-item")
      .filter({ hasText: "department" })
      .getByRole("button", { name: "text", exact: true })
      .click();
    await page.locator("#btn-describe-send-answers").click();
    await page
      .locator(".describe-proposal-source")
      .filter({ hasText: "department" })
      .waitFor();
    await page
      .locator(".describe-interpretation-card")
      .filter({ hasText: "Review generated meaning and effects" })
      .waitFor();
    await page.locator("#btn-describe-apply").click();
    await page.locator("#editor").waitFor({ state: "visible" });
    assert.ok((await page.locator("#editor").inputValue()).includes("department"));
    const confirmations = JSON.parse(
      await readFile(`${sourcePath}.confirmations.json`, "utf8")
    ) as unknown[];
    assert.equal(confirmations.length, 1);
  } finally {
    await browser.close();
    await studio.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("Studio workspaces remain responsive on mobile", async () => {
  const studio = await startStudio({ sourcePath: resolve("examples/focus-board.intent"), port: 3355, noOpen: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(studio.url);
    await page.locator("#editor").waitFor({ state: "visible" });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      "Code workspace should not overflow the mobile viewport"
    );

    await page.locator("#nav-builder").click();
    await page.locator("#wiz-description").waitFor({ state: "visible" });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      "App Builder should not overflow the mobile viewport"
    );
  } finally {
    await browser.close();
    await studio.close();
  }
});
