import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, compileSource, formatSource } from "../src/compiler.js";
import { compilePageSource } from "../src/web.js";

const SEEDS = [1, 7, 42, 20260925, 0x7fffffff];
const CASES_PER_SEED = Number.parseInt(
  process.env["INTENTLANG_FUZZ_CASES"] ?? "1000",
  10
);

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function word(next: () => number, prefix: string): string {
  return `${prefix}${Math.floor(next() * 1_000_000)}`;
}

function program(next: () => number): string {
  const app = word(next, "App");
  const entity = word(next, "Entity");
  const fieldCount = 1 + Math.floor(next() * 5);
  const fields: string[] = [];
  for (let index = 0; index < fieldCount; index += 1) {
    const name = `field${index}`;
    const kind = Math.floor(next() * 3);
    if (kind === 0) {
      fields.push(
        `a ${entity} has a ${next() > 0.5 ? "required " : ""}${name} as text length between 1 and ${2 + Math.floor(next() * 200)}`
      );
    } else if (kind === 1) {
      fields.push(
        `a ${entity} has a ${name} as integer default ${Math.floor(next() * 200) - 100}`
      );
    } else {
      fields.push(
        `a ${entity} has a ${name} as boolean default ${next() > 0.5 ? "true" : "false"}`
      );
    }
  }
  return [`application ${app}`, ...fields].join("\n") + "\n";
}

test("seeded compiler and formatter properties remain deterministic", () => {
  for (const seed of SEEDS) {
    const next = random(seed);
    for (let index = 0; index < CASES_PER_SEED; index += 1) {
      const source = program(next);
      const first = compileSource(source);
      assert.equal(first.ok, true, `seed=${seed} case=${index}`);
      if (!first.ok) continue;
      const canonical = formatSource(first.ir);
      const second = compileSource(canonical);
      assert.equal(second.ok, true, `seed=${seed} case=${index}`);
      if (!second.ok) continue;
      assert.equal(formatSource(second.ir), canonical, `seed=${seed} case=${index}`);
      assert.equal(
        canonicalJson(second.ir),
        canonicalJson(first.ir),
        `seed=${seed} case=${index}`
      );
    }
  }
});

test("seeded malformed mutations never throw or produce partial success", () => {
  const mutations = [
    "\u0000",
    "\ud800",
    "application app",
    "application App\n  field is required",
    "application App\nentity Same with id same\nentity Same with id same-2",
    "application App\n" + "x".repeat(50_000)
  ];
  for (const source of mutations) {
    assert.doesNotThrow(() => compileSource(source));
    assert.equal(compileSource(source).ok, false);
  }
});

test("page compiler enforces the documented source resource limit", () => {
  const validStatement = "\nAdd a paragraph called status";
  const atLimit = compilePageSource(
    `#${"x".repeat(20_000 - validStatement.length - 1)}${validStatement}`
  );
  const overLimit = compilePageSource("x".repeat(20_001));
  assert.equal(atLimit.ok, true);
  assert.equal(overLimit.ok, false);
  if (!overLimit.ok) {
    assert.deepEqual(
      [...new Set(overLimit.diagnostics.map(({ code }) => code))],
      ["W001"]
    );
  }
});
