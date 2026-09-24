import assert from "node:assert/strict";
import test from "node:test";
import { compileSource } from "../src/compiler.js";
import { buildManifest } from "../src/manifest.js";
import { generateRuntime } from "../src/runtime-codegen.js";
import { generateUi } from "../src/ui-codegen.js";

function runtime(): string {
  const result = compileSource(`application Runtime
a Task has a required title as text
a Task has a done as boolean default false
action complete a Task
  require done is false otherwise "Already complete"
  set done to true
`);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("compile failed");
  return generateRuntime(
    result.ir,
    buildManifest(result.ir),
    generateUi(result.ir)
  ).appMjs;
}

test("every mutation path has idempotency, transaction, rollback, and audit machinery", () => {
  const code = runtime();
  for (const required of [
    "replayIdempotency",
    "storeIdempotency",
    "db.exec('BEGIN')",
    "db.exec('COMMIT')",
    "db.exec('ROLLBACK')",
    "auditLog(",
    "VERSION_CONFLICT",
    "PRECONDITION_FAILED"
  ]) {
    assert.ok(code.includes(required), required);
  }
  assert.ok(
    code.indexOf("db.exec('BEGIN')") < code.indexOf("db.exec('COMMIT')")
  );
});

test("generated mutation errors are explicit and never success-shaped", () => {
  const code = runtime();
  for (const failure of [
    "MISSING_IDEMPOTENCY_KEY",
    "IDEMPOTENCY_KEY_REUSED",
    "VERSION_CONFLICT",
    "PRECONDITION_FAILED",
    "VALIDATION_ERROR",
    "UNIQUE_CONFLICT"
  ]) {
    assert.ok(code.includes(failure), failure);
  }
  assert.ok(!/catch\s*\{\s*\}/.test(code));
});
