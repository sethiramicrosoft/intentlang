import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Script } from "node:vm";
import { compileVisualSource } from "../src/visual.js";
import { compileEnglishSource } from "../src/english.js";
import { getWebCatalogue } from "../src/web-catalogue.js";
import { PAGE_EXAMPLES } from "../src/web-examples.js";
import { VISUAL_JS } from "../src/visual-assets.js";
import { startStudio } from "../src/studio-server.js";

test("visual language compiles Hello World and generates deterministic standalone HTML", () => {
  const source = 'Show "Hello, world!".';
  const result = compileVisualSource(source);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected success");
  assert.deepEqual(result, compileVisualSource(source));
  assert.equal(result.ir.text, "Hello, world!");
  assert.equal(result.ir.position, "center");
  assert.match(result.html, /<p id="text">Hello, world!<\/p>/);
  assert.doesNotMatch(result.html, /<script|src=|href=/);
  const css = /<style>([\s\S]*?)<\/style>/.exec(result.html)![1]!;
  assert.ok(result.html.includes(`sha256-${createHash("sha256").update(css).digest("base64")}`));
  assert.doesNotThrow(() => new Script(VISUAL_JS));
});

test("visual language supports styling, keyword case, comments and optional periods", () => {
  const result = compileVisualSource('# comment\r\n MAKE THE TEXT LARGE.\r\nShow "Mixed Case"\r\nMake the text red.\r\nMake the background light blue.\r\nPlace the text at the bottom.');
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  assert.equal(result.ir.text, "Mixed Case");
  assert.equal(result.ir.fontSize, 64);
  assert.equal(result.ir.textColor, "#dc2626");
  assert.equal(result.ir.backgroundColor, "#bae6fd");
  assert.equal(result.ir.position, "bottom");
});

test("natural display instructions preserve literal text without requiring quotes or escapes", () => {
  for (const text of [
    "Hello, world!", "This is a sentence.", "Rock and roll", "123",
    String.raw`C:\notes\new.txt`, "Say \"Hello\" to everyone", "<img src=x onerror=alert(1)>",
    "caf\u00e9 \u{1f30d}"
  ]) {
    const result = compileVisualSource("Show " + text);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    assert.equal(result.ir.text, text);
    assert.ok(!result.html.includes("<img"));
  }
});

test("natural display lists and composable word layout produce identical pages", () => {
  const sources = [
    "Show the words THINK, BUILD and MOVE on separate lines",
    "Show THINK, BUILD, and MOVE on separate lines.",
    "Display THINK and BUILD and MOVE on separate lines",
    'Show "THINK", "BUILD" and "MOVE" on separate lines',
    "Show THINK BUILD MOVE\nPut each word on a new line",
    "Put each word on a separate line\nShow THINK BUILD MOVE",
    "Show THINK BUILD MOVE\nPut each word on its own line"
  ];
  const pages = sources.map((source) => {
    const result = compileVisualSource(source);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    assert.ok(result.html.includes('id="text">THINK\nBUILD\nMOVE</p>'));
    return result.html;
  });
  assert.ok(pages.every((page) => page === pages[0]));
});

test("display list grouping respects phrases and optional natural quotation", () => {
  for (const source of [
    "Show FIRST STEP, NEXT STEP and LAST STEP on separate lines",
    'Show the words "FIRST STEP", NEXT STEP and "LAST STEP" on separate lines'
  ]) {
    const result = compileVisualSource(source);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    assert.equal(result.ir.text, "FIRST STEP\nNEXT STEP\nLAST STEP");
  }
  const grouped = compileVisualSource('Show "Rock and roll", Jazz and Blues on separate lines');
  if (!grouped.ok) throw new Error(JSON.stringify(grouped.diagnostics));
  assert.equal(grouped.ir.text, "Rock and roll\nJazz\nBlues");
  const single = compileVisualSource("Show THINK, BUILD and MOVE on separate lines\nPut all the text on one line");
  if (!single.ok) throw new Error(JSON.stringify(single.diagnostics));
  assert.ok(single.html.includes('id="text">THINK BUILD MOVE</p>'));
});

test("natural layout asks for unclear grouping and rejects incomplete lists", () => {
  const unclear = compileVisualSource("Show Hello world on separate lines");
  if (unclear.ok) throw new Error("Expected grouping clarification");
  assert.equal(unclear.diagnostics.length, 1);
  assert.equal(unclear.diagnostics[0]?.category, "ambiguity");
  const suggestions = unclear.diagnostics[0]!.suggestions!;
  assert.equal(suggestions.length, 2);
  assert.ok(suggestions.every((suggestion) => compileVisualSource(suggestion.replacement).ok));
  for (const source of [
    "Show THINK,,MOVE on separate lines", "Show THINK and on separate lines",
    "Show THINK, on separate lines", "Show and THINK on separate lines",
    "Show Hello\nPut each word on a new line\nPut the text on one line"
  ]) {
    assert.equal(compileVisualSource(source).ok, false, source);
  }
});

test("spelling suggestions correct a display verb without changing unquoted content", () => {
  const result = compileVisualSource("Shwo larg bule text");
  if (result.ok) throw new Error("Expected a suggestion");
  const replacement = result.diagnostics.find((item) => item.category === "typo")?.suggestions?.[0]?.replacement;
  assert.equal(replacement, "show larg bule text");
  const compiled = compileVisualSource(replacement);
  if (!compiled.ok) throw new Error("Corrected verb should compile");
  assert.equal(compiled.ir.text, "larg bule text");
});

test("visual grammar composes modifiers and synonyms rather than matching complete example sentences", () => {
  for (const verb of ["Make", "Set"]) {
    for (const modifiers of [
      "large and blue and bold", "large, bold and blue", "bold and large and blue",
      "bold, blue, and large", "blue and large and bold", "blue, bold, large"
    ]) {
      const result = compileVisualSource(`Display "Composition".\n${verb} the text ${modifiers}.`);
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      assert.equal(result.ir.fontSize, 64);
      assert.equal(result.ir.fontWeight, 700);
      assert.equal(result.ir.textColor, "#2563eb");
      assert.match(result.html, /font-weight:700/);
    }
  }
  const result = compileVisualSource('Show "Composition".\nSet it to 48 pixels, bold and italic.');
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  assert.equal(result.ir.fontSize, 48);
  assert.equal(result.ir.fontWeight, 700);
  assert.equal(result.ir.fontStyle, "italic");
  const plain = compileVisualSource('Show "Plain".\nMake text not bold and not italic.');
  if (!plain.ok) throw new Error(JSON.stringify(plain.diagnostics));
  assert.equal(plain.ir.fontWeight, 400);
  assert.equal(plain.ir.fontStyle, "normal");
});

test("visual grammar diagnoses conflicting or incomplete modifier lists", () => {
  for (const modifiers of ["large and small", "bold and regular", "italic and upright",
    "blue and red", "large and", "and bold", "large,,bold", "large and and bold"]) {
    assert.equal(compileVisualSource(`Show "Hello".\nMake the text ${modifiers}.`).ok, false, modifiers);
  }
  const result = compileVisualSource('Show "Hello".\nMake the text large and bold and sparkling.');
  if (result.ok) throw new Error("Expected unsupported property");
  assert.equal(result.diagnostics[0]?.category, "syntax");
  assert.match(result.diagnostics[0]!.message, /sparkling/);
  assert.ok(!("html" in result));
});

test("underline works as a modifier, synonym or direct action and composes with other styles", () => {
  for (const instruction of [
    "Make the text underline", "Make the text underlined", "Set text to underlined",
    "Underline the text", "Underline it", "Make it underlined"
  ]) {
    const result = compileVisualSource(`Show Underline\n${instruction}`);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    assert.equal(result.ir.underlined, true);
    assert.match(result.html, /text-decoration-line:underline/);
  }
  for (const modifiers of [
    "large, bold, italic, blue and underlined",
    "underline and blue and italic and bold and large"
  ]) {
    const result = compileVisualSource(`Show Styled\nMake the text ${modifiers}`);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    assert.equal(result.ir.underlined, true);
    assert.equal(result.ir.fontWeight, 700);
    assert.equal(result.ir.fontStyle, "italic");
    assert.equal(result.ir.fontSize, 64);
    assert.equal(result.ir.textColor, "#2563eb");
  }
  for (const style of ["not underlined", "no underline"]) {
    const result = compileVisualSource(`Show Plain\nMake it ${style}`);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    assert.equal(result.ir.underlined, false);
    assert.match(result.html, /text-decoration-line:none/);
  }
  for (const instruction of ["Make the background underlined", "Underline the background",
    "Make the text underlined and not underlined"]) {
    assert.equal(compileVisualSource(`Show Invalid\n${instruction}`).ok, false);
  }
  const typo = compileVisualSource("Show Underline\nMake it underlind");
  if (typo.ok) throw new Error("Expected explicit spelling suggestion");
  assert.ok(typo.diagnostics.some((item) => item.suggestions?.some((choice) =>
    choice.replacement.includes("underlined"))));
});

test("visual ambiguity distinguishes unknown references, competing targets and ambiguous properties", () => {
  const normalSource = 'Show "Hello".\nMake the text normal.';
  const normal = compileVisualSource(normalSource);
  if (normal.ok) throw new Error("Expected ambiguity");
  assert.equal(normal.diagnostics[0]?.category, "ambiguity");
  const suggestions = normal.diagnostics[0]!.suggestions!;
  assert.equal(suggestions.length, 3);
  for (const choice of suggestions) {
    assert.equal(compileVisualSource('Show "Hello".\n' + choice.replacement).ok, true);
  }
  const pronoun = compileVisualSource('Show "Hello".\nMake the background white.\nMake it blue.');
  if (pronoun.ok) throw new Error("Expected competing targets");
  const ambiguous = pronoun.diagnostics.find((item) => item.category === "ambiguity");
  assert.equal(ambiguous?.line, 3);
  assert.deepEqual(ambiguous?.suggestions?.map((item) => item.replacement),
    ["Make the text blue.", "Make the background blue."]);
  const undefinedTarget = compileVisualSource('Make it blue.\nShow "Hello".');
  if (undefinedTarget.ok) throw new Error("Expected missing reference");
  assert.match(undefinedTarget.diagnostics[0]!.message, /earlier target/);
  const clear = compileVisualSource('Show "Hello".\nMake it large and bold.\nSlide it from left to right over 3 seconds.');
  assert.equal(clear.ok, true);
});

test("visual ambiguity offers movement direction choices and preserves explicit duration", () => {
  for (const suffix of ["", " over 5 seconds"]) {
    const result = compileVisualSource(`Show "Hello".\nMove the text across the screen${suffix}.`);
    if (result.ok) throw new Error("Expected direction ambiguity");
    assert.equal(result.diagnostics[0]?.category, "ambiguity");
    assert.equal(result.diagnostics[0]?.suggestions?.length, 2);
    for (const choice of result.diagnostics[0]!.suggestions!) {
      assert.ok(choice.replacement.includes(suffix ? "5 seconds" : "3 seconds"));
      assert.equal(compileVisualSource('Show "Hello".\n' + choice.replacement).ok, true);
    }
  }
});

test("visual spelling suggestions are explicit, compiler-checked, and never rewrite quoted text", () => {
  for (const line of ["Make the text larg and bold.", "Mkae the text blue.",
    "Make the text bule and italic.", "Move the text from left to rihgt over 3 seconds."]) {
    const source = 'Show "larg and bule".\n' + line;
    const result = compileVisualSource(source);
    if (result.ok) throw new Error("Typos must not be silently accepted");
    const diagnostic = result.diagnostics.find((item) => item.category === "typo");
    assert.ok(diagnostic?.suggestions?.length, line);
    for (const choice of diagnostic.suggestions) {
      const corrected = compileVisualSource('Show "larg and bule".\n' + choice.replacement);
      if (!corrected.ok) throw new Error(JSON.stringify(corrected.diagnostics));
      assert.equal(corrected.ir.text, "larg and bule");
    }
  }
  for (const source of ['Show "larg bule".', 'Shwo "larg bule".', 'Show "larg bule']) {
    const result = compileVisualSource(source);
    if (result.ok) {
      assert.equal(result.ir.text, "larg bule");
    } else {
      for (const diagnostic of result.diagnostics) {
        for (const suggestion of diagnostic.suggestions ?? []) {
          assert.ok(suggestion.replacement.includes('"larg bule"'));
        }
      }
      if (source.endsWith("bule")) {
        assert.equal(result.diagnostics.some((item) => item.suggestions), false);
      }
    }
  }
});

test("visual language escapes text as data, including quotes, line breaks, markup and Unicode", () => {
  const text = '<script>alert("hi")</script>\n<img src=x onerror=alert(1)>& "Hello" \u{1f30d}';
  const result = compileVisualSource(`Show ${JSON.stringify(text)}.`);
  if (!result.ok) throw new Error("Expected success");
  assert.equal(result.ir.text, text);
  assert.ok(result.html.includes("&lt;script&gt;"));
  assert.ok(result.html.includes("&lt;img"));
  assert.ok(!result.html.includes("<script"));
  assert.ok(!result.html.includes("<img"));
});

test("visual language supports all four directions and duration limits", () => {
  for (const [from, to] of [["left", "right"], ["right", "left"], ["top", "bottom"], ["bottom", "top"]]) {
    for (const seconds of [0.1, 3, 60]) {
      const result = compileVisualSource(`Show "Move".\nMove the text from ${from} to ${to} over ${seconds} seconds.`);
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      assert.deepEqual(result.ir.movement, { from, to, seconds });
      assert.match(result.html, /@keyframes travel/);
      assert.ok(result.html.includes(`animation:travel ${seconds}s linear 1 both`));
      assert.match(result.html, /prefers-reduced-motion:reduce/);
    }
  }
});

test("visual language supports all positions and size boundaries", () => {
  for (const position of ["left", "right", "top", "bottom", "center"]) {
    for (const size of [12, 160]) {
      const result = compileVisualSource(`Show "Position".\nPlace the text at the ${position}.\nMake the text ${size} pixels.`);
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      assert.equal(result.ir.position, position);
      assert.equal(result.ir.fontSize, size);
    }
  }
});

test("visual language rejects unknown or conflicting instructions without producing partial output", () => {
  const invalid = [
    "", "# only a comment", 'Show "".', 'Show "   ".', 'Show "bad\\q".',
    'Show "A".\nShow "B".', 'Show "A".\nMake the text blue.\nMake the text red.',
    'Show "A".\nMake the text 11 pixels.', 'Show "A".\nMake the text 161 pixels.',
    'Show "A".\nMake the text constructor.', 'Show "A".\nMake the background large.',
    'Show "A".\nPlace the text at the left.\nPlace the text at the right.',
    'Show "A".\nMove the text from left to top over 3 seconds.',
    'Show "A".\nMove the text from left to right over 0 seconds.',
    'Show "A".\nMove the text from left to right over 61 seconds.',
    'Show "A".\nMove the text from left to right over 3 seconds.\nMove the text from top to bottom over 3 seconds.',
    'Show "A".\nMake it dance.', `Show "${"x".repeat(2001)}".`
  ];
  for (const source of invalid) {
    const result = compileVisualSource(source);
    assert.equal(result.ok, false, source);
    if (result.ok) throw new Error("Expected diagnostics");
    assert.ok(result.diagnostics.length > 0);
    assert.ok(result.diagnostics.every((item) => item.line > 0 && item.hint.length > 0));
    assert.ok(!("html" in result));
  }
  const result = compileVisualSource('Show "Hello".\n  Make it dance.');
  if (result.ok) throw new Error("Expected diagnostics");
  assert.equal(result.diagnostics[0]?.line, 2);
  assert.equal(result.diagnostics[0]?.column, 3);
});

test("visual CLI emits HTML, gates writes, refuses source overwrite and diagnoses invalid input", async () => {
  const dir = await mkdtemp(join(tmpdir(), "intentlang-visual-"));
  const sourcePath = join(dir, "hello.intent");
  const outputPath = join(dir, "hello.html");
  const args = ["--import", "tsx", "src/cli.ts", "visual", sourcePath];
  try {
    await writeFile(sourcePath, 'Show "Hello".');
    const stdout = execFileSync(process.execPath, args, { encoding: "utf8" });
    assert.match(stdout, /<!doctype html>/);
    assert.equal(spawnSync(process.execPath, [...args, "--output", outputPath]).status, 2);
    execFileSync(process.execPath, [...args, "--output", outputPath, "--write"]);
    assert.equal(await readFile(outputPath, "utf8"), stdout);
    assert.equal(spawnSync(process.execPath, [...args, "--output", outputPath, "--write"]).status, 2);
    assert.equal(spawnSync(process.execPath, [...args, "--output", sourcePath, "--write", "--force"]).status, 2);
    assert.equal(await readFile(sourcePath, "utf8"), 'Show "Hello".');
    await writeFile(sourcePath, 'Show "Hello".\nDance.');
    const failed = spawnSync(process.execPath, args, { encoding: "utf8" });
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /V001/);
    assert.equal(failed.stdout, "");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("visual Studio routes serve playground, protect compilation and never write the source", async () => {
  const sourcePath = resolve("examples/todo.intent");
  const before = await readFile(sourcePath, "utf8");
  const studio = await startStudio({ sourcePath, port: 3350, noOpen: true });
  try {
    for (const route of ["/playground", "/visual.js", "/visual.css"]) {
      assert.equal((await fetch(studio.url + route)).status, 200);
    }
    assert.match(await (await fetch(studio.url + "/playground")).text(), /sandbox=""/);
    const catalogueResponse = await fetch(studio.url + "/api/visual/capabilities");
    assert.equal(catalogueResponse.status, 200);
    assert.deepEqual(await catalogueResponse.json(), JSON.parse(JSON.stringify(getWebCatalogue())));
    const state = await (await fetch(studio.url + "/api/state")).json() as { csrfToken: string };
    const endpoint = studio.url + "/api/visual/compile";
    assert.equal((await fetch(endpoint, { method: "POST", body: "{}" })).status, 403);
    const headers = { "Content-Type": "application/json", Origin: studio.url, "X-Studio-CSRF-Token": state.csrfToken };
    assert.equal((await fetch(endpoint, { method: "POST", headers: { ...headers, Origin: "http://other.invalid" }, body: "{}" })).status, 403);
    for (const body of [null, {}, { source: 42 }, { source: "x".repeat(20001) }]) {
      assert.equal((await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) })).status, 400);
    }
    for (const source of ['Show "Hi".', 'Show "Hi".\nDance.', PAGE_EXAMPLES.webpage, "Add a script called program"]) {
      const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ source }) });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), compileEnglishSource(source));
    }
    assert.equal(await readFile(sourcePath, "utf8"), before);
  } finally {
    await studio.close();
  }
});
