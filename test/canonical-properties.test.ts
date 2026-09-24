import assert from "node:assert/strict";
import test from "node:test";
import { compileSource, formatSource } from "../src/compiler.js";
import { canonicalProgram } from "../src/language/canonical.js";

const sources = [
  "application Todo\na Task has a required title as text\n",
  "application Todo with id todo\nentity Task with id task\n  title is required text with id task-title\n",
  "application Work with id work\nentity User with id user\n  email is required unique text with id user-email\nentity Task with id task\n  done is boolean with id task-done default false\nTask belongs to User as owner with id task-owner on delete restrict\n"
];

test("canonical formatting is compile-format-compile idempotent", () => {
  for (const source of sources) {
    const first = compileSource(source);
    assert.equal(first.ok, true);
    if (!first.ok) continue;
    const canonical = formatSource(first.ir);
    const second = compileSource(canonical);
    assert.equal(second.ok, true);
    if (!second.ok) continue;
    assert.equal(formatSource(second.ir), canonical);
    assert.deepEqual(canonicalProgram(second.ir), canonicalProgram(first.ir));
  }
});
