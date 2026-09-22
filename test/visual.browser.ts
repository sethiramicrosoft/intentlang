import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { startStudio } from "../src/studio-server.js";

test("visual playground renders, animates, diagnoses and exports in a real browser", async () => {
  const dir = await mkdtemp(join(tmpdir(), "intentlang-browser-"));
  const studio = await startStudio({ sourcePath: resolve("examples/todo.intent"), port: 3351, noOpen: true });
  try {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ reducedMotion: "no-preference" });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(studio.url + "/playground");
      await page.locator("#status").filter({ hasText: "Ready." }).waitFor();
      const text = () => page.frameLocator("#preview").locator("#text");
      assert.equal(await text().textContent(), "Hello, world!");
      assert.equal(await page.locator("#source").inputValue(), "Show Hello, world!");
      await page.locator("#lesson").selectOption("style");
      await page.locator("#status").filter({ hasText: "Ready." }).waitFor();
      assert.equal(await text().evaluate((element) => getComputedStyle(element).fontSize), "64px");
      await page.locator("#lesson").selectOption("lines");
      await page.locator("#status").filter({ hasText: "Ready." }).waitFor();
      assert.equal(await text().textContent(), "THINK\nBUILD\nMOVE");
      assert.doesNotMatch(await page.locator("#source").inputValue(), /["\\{};]/);
      await page.locator("#lesson").selectOption("poster");
      await page.locator("#status").filter({ hasText: "Ready." }).waitFor();
      assert.equal(await text().textContent(), "THINK\nBUILD\nMOVE");
      assert.doesNotMatch(await page.locator("#source").inputValue(), /["\\{};]/);
      await page.locator("#source").fill('Show "Live editing works".');
      await page.locator("#status").filter({ hasText: "Ready." }).waitFor();
      assert.equal(await text().textContent(), "Live editing works");
      async function run(source: string): Promise<void> {
        await page.locator("#source").fill(source);
        await page.locator("#run").click();
        await page.locator("#status").filter({ hasText: "Ready." }).waitFor();
        await text().waitFor();
      }
      await run(String.raw`Show C:\notes\new.txt`);
      assert.equal(await text().textContent(), String.raw`C:\notes\new.txt`);
      await page.locator("#source").fill("Show Hello world on separate lines");
      await page.locator("#run").click();
      await page.locator("#status").filter({ hasText: "Ambiguous instructions" }).waitFor();
      assert.equal(await page.locator("#source").inputValue(), "Show Hello world on separate lines");
      await page.getByRole("button", { name: /^One word per line/ }).click();
      await page.locator("#status").filter({ hasText: "Ready." }).waitFor();
      assert.equal(await page.locator("#source").inputValue(), "Show Hello world\nPut each word on a new line");
      assert.equal(await text().textContent(), "Hello\nworld");
      await run('Show "Custom greeting".\nMake the text red.\nMake the background light blue.\nMake the text 48 pixels.');
      assert.deepEqual(await text().evaluate((element) => ({
        text: element.textContent,
        color: getComputedStyle(element).color,
        size: getComputedStyle(element).fontSize,
        background: getComputedStyle(document.body).backgroundColor
      })), { text: "Custom greeting", color: "rgb(220, 38, 38)", size: "48px", background: "rgb(186, 230, 253)" });

      await run('Show Compound styles\nMake the text large, bold, italic and underlined');
      assert.deepEqual(await text().evaluate((element) => ({
        size: getComputedStyle(element).fontSize,
        weight: getComputedStyle(element).fontWeight,
        slant: getComputedStyle(element).fontStyle,
        decoration: getComputedStyle(element).textDecorationLine
      })), { size: "64px", weight: "700", slant: "italic", decoration: "underline" });
      await run("Show Underline\nUnderline it");
      assert.equal(await text().evaluate((element) => getComputedStyle(element).textDecorationLine), "underline");
      await run("Show Plain\nMake the text not underlined");
      assert.equal(await text().evaluate((element) => getComputedStyle(element).textDecorationLine), "none");

      await page.locator("#source").fill('Show "Keep larg as written".\nMake the text larg and bold.');
      await page.locator("#run").click();
      await page.locator("#problems").filter({ hasText: "Possible typo" }).waitFor();
      assert.equal(await page.locator("#download").isDisabled(), true);
      assert.match(await page.locator("#source").inputValue(), /text larg and bold/);
      await page.getByRole("button", { name: /Apply spelling suggestion/ }).click();
      await page.locator("#status").filter({ hasText: "Ready." }).waitFor();
      assert.equal(await text().textContent(), "Keep larg as written");
      assert.equal(await page.locator("#source").inputValue(),
        'Show "Keep larg as written".\nMake the text large and bold.');

      await page.locator("#source").fill('Show "Choose a meaning".\nMake the text normal.');
      await page.locator("#run").click();
      await page.locator("#status").filter({ hasText: "Ambiguous instructions" }).waitFor();
      assert.equal(await page.locator(".suggestion").count(), 3);
      assert.equal(await page.locator("#preview").isVisible(), false);
      assert.match(await page.locator("#source").inputValue(), /text normal/);
      await page.getByRole("button", { name: /Normal weight/ }).click();
      await page.locator("#status").filter({ hasText: "Ready." }).waitFor();
      assert.match(await page.locator("#source").inputValue(), /text regular/);
      assert.equal(await text().evaluate((element) => getComputedStyle(element).fontWeight), "400");

      await page.locator("#source").fill('Show "Choose a target".\nMake the background white.\nMake it blue.');
      await page.locator("#run").click();
      await page.locator("#status").filter({ hasText: "Ambiguous instructions" }).waitFor();
      await page.getByRole("button", { name: /Use the text/ }).click();
      await page.locator("#status").filter({ hasText: "Ready." }).waitFor();
      assert.match(await page.locator("#source").inputValue(), /Make the text blue/);

      await page.locator("#source").fill('Show "Choose a direction".\nMove it across the screen over 5 seconds.');
      await page.locator("#run").click();
      await page.locator("#status").filter({ hasText: "Ambiguous instructions" }).waitFor();
      await page.getByRole("button", { name: /^left to right/ }).click();
      await page.locator("#status").filter({ hasText: "Ready." }).waitFor();
      assert.match(await page.locator("#source").inputValue(), /from left to right over 5 seconds/);

      for (const viewport of [{ width: 1280, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        for (const [from, to, axis] of [
          ["left", "right", "x"], ["right", "left", "x"],
          ["top", "bottom", "y"], ["bottom", "top", "y"]
        ] as const) {
          await run(`Show "Hello".\nMove the text from ${from} to ${to} over 3 seconds.`);
          const boxes = await text().evaluate((element) => {
            const animation = element.getAnimations()[0];
            if (!animation) throw new Error("Animation missing");
            animation.pause();
            const frames = [0, 1500, 3000].map((time) => {
              animation.currentTime = time;
              const rect = element.getBoundingClientRect();
              return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            });
            const stage = element.parentElement!.getBoundingClientRect();
            return { start: frames[0]!, middle: frames[1]!, end: frames[2]!, stage: { x: stage.x, y: stage.y, right: stage.right, bottom: stage.bottom } };
          });
          const sign = from === "left" || from === "top" ? 1 : -1;
          assert.ok((boxes.end[axis] - boxes.start[axis]) * sign > 30, `${from} to ${to} at ${viewport.width}`);
          assert.ok(Math.abs(boxes.middle[axis] - (boxes.start[axis] + boxes.end[axis]) / 2) < 2);
          for (const box of [boxes.start, boxes.middle, boxes.end]) {
            assert.ok(box.x >= boxes.stage.x - 1 && box.y >= boxes.stage.y - 1);
            assert.ok(box.x + box.width <= boxes.stage.right + 1);
            assert.ok(box.y + box.height <= boxes.stage.bottom + 1);
          }
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }

      await page.emulateMedia({ reducedMotion: "reduce" });
      await run('Show "Still".\nPlace the text at the top.\nMove the text from bottom to top over 3 seconds.');
      assert.equal(await text().evaluate((element) => element.getAnimations().length), 0);
      assert.equal(await page.locator(".motion-note").isVisible(), true);

      const literal = '<script>throw new Error("should not run")</script>';
      await run(`Show ${JSON.stringify(literal)}.`);
      assert.equal(await text().textContent(), literal);
      assert.equal(await page.frameLocator("#preview").locator("script").count(), 0);
      const downloadEvent = page.waitForEvent("download");
      await page.locator("#download").click();
      const download = await downloadEvent;
      const htmlPath = join(dir, "export.html");
      await download.saveAs(htmlPath);
      const html = await readFile(htmlPath, "utf8");
      assert.match(html, /&lt;script&gt;/);
      const standalone = await browser.newPage();
      await standalone.goto(pathToFileURL(htmlPath).href);
      assert.equal(await standalone.locator("#text").textContent(), literal);
      assert.equal(await standalone.locator("#text").evaluate((element) => getComputedStyle(element).color), "rgb(37, 99, 235)");
      await standalone.close();

      await page.locator("#source").fill('Show "Hello".\nMake it dance.');
      await page.locator("#run").click();
      await page.locator("#status").filter({ hasText: "Fix the instructions" }).waitFor();
      assert.match(await page.locator("#problems").textContent() ?? "", /Line 2/);
      assert.equal(await page.locator("#preview").isVisible(), false);
      assert.equal(await page.locator("#download").isDisabled(), true);

      let release: (() => void) | undefined;
      const delayed = new Promise<void>((resolveDelay) => { release = resolveDelay; });
      await page.route("**/api/visual/compile", async (route) => {
        const body = route.request().postDataJSON() as { source: string };
        if (body.source === 'Show "Old response".') await delayed;
        await route.continue();
      });
      const oldRequest = page.waitForRequest((request) =>
        request.url().endsWith("/api/visual/compile") && request.postData()?.includes("Old response") === true);
      await page.locator("#source").fill('Show "Old response".');
      await page.locator("#run").click();
      await oldRequest;
      await run('Show "Latest response".');
      const oldResponse = page.waitForResponse((response) =>
        response.url().endsWith("/api/visual/compile") && response.request().postData()?.includes("Old response") === true);
      release!();
      await (await oldResponse).finished();
      assert.equal(await text().textContent(), "Latest response");
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  } finally {
    await studio.close();
    await rm(dir, { recursive: true, force: true });
  }
});
