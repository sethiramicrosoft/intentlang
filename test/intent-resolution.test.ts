import assert from "node:assert/strict";
import test from "node:test";
import {
  extractIntentConcepts,
  resolveIntent
} from "../src/language/intent-resolution.js";
import { compileSource } from "../src/compiler.js";

const description =
  "Build an app that allows users to add their own name, age and address.";

test("concept extraction identifies identity and ownership ambiguity", () => {
  const concepts = extractIntentConcepts(description);
  assert.equal(concepts.requestsUsers, true);
  assert.equal(concepts.requestsOwnership, true);
});

test("intent resolution asks stable categorized clarification questions", () => {
  const result = resolveIntent(description);
  assert.equal(result.kind, "clarification");
  if (result.kind !== "clarification") return;
  assert.deepEqual(
    result.questions.map((question) => question.id),
    ["security.identity", "ownership.scope"]
  );
});

test("reviewed answers produce compiler-validated canonical source", () => {
  const answers = {
    "security.identity": "person-record",
    "ownership.scope": "owner-only"
  };
  const first = resolveIntent(description, answers);
  const second = resolveIntent(description, answers);
  assert.equal(first.kind, "proposal");
  assert.deepEqual(first, second);
  if (first.kind !== "proposal") return;
  assert.equal(compileSource(first.canonicalSource).ok, true);
  assert.ok(first.explanations.security[0]!.includes("No authentication"));
  assert.match(first.confirmationFingerprint, /^sha256:[a-f0-9]{64}$/);
});

test("unsupported effects require an explicit failure-mode decision", () => {
  const request =
    "Build an app that allows people to add name and send email notifications.";
  const clarification = resolveIntent(request);
  assert.equal(clarification.kind, "clarification");
  if (clarification.kind !== "clarification") return;
  assert.ok(
    clarification.questions.some(
      (question) => question.id === "failure-mode.unsupported"
    )
  );
  const rejected = resolveIntent(request, {
    "failure-mode.unsupported": "reject-proposal"
  });
  assert.equal(rejected.kind, "unrecognized");
});

test("unknown fields require explicit type clarification and can be added safely", () => {
  const request = "Build an app with name and department.";
  const clarification = resolveIntent(request);
  assert.equal(clarification.kind, "clarification");
  if (clarification.kind !== "clarification") return;
  assert.ok(
    clarification.questions.some(
      (question) => question.id === "type.department"
    )
  );
  const proposal = resolveIntent(request, { "type.department": "text" });
  assert.equal(proposal.kind, "proposal");
  if (proposal.kind !== "proposal") return;
  assert.ok(proposal.canonicalSource.includes("department"));
});
