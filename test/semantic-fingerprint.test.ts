import assert from "node:assert/strict";
import test from "node:test";
import { compileSource } from "../src/compiler.js";
import {
  artifactFingerprint,
  buildSemanticManifest,
  dependencyFingerprint,
  semanticFingerprint,
  sourceFingerprint
} from "../src/language/semantic-fingerprint.js";
import { COMPILER_VERSION } from "../src/manifest.js";

function ir(source: string) {
  const result = compileSource(source);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("compile failed");
  return result.ir;
}

test("equivalent natural and canonical source have identical fingerprints", () => {
  const natural = ir("application Todo\na Task has a required title as text\n");
  const explicit = ir("application Todo with id todo\nentity Task with id task\n  title is required text with id task-title\n");
  assert.equal(sourceFingerprint(natural), sourceFingerprint(explicit));
  assert.equal(semanticFingerprint(natural), semanticFingerprint(explicit));
});

test("artifact fingerprint is path-order independent and content sensitive", () => {
  const first = artifactFingerprint({
    "index.html": "<h1>Hello</h1>",
    "app.js": "console.log('hello')"
  });
  const reordered = artifactFingerprint({
    "app.js": "console.log('hello')",
    "index.html": "<h1>Hello</h1>"
  });
  const changed = artifactFingerprint({
    "app.js": "console.log('changed')",
    "index.html": "<h1>Hello</h1>"
  });
  assert.equal(first, reordered);
  assert.notEqual(first, changed);
});

test("meaning changes alter semantic and source fingerprints", () => {
  const before = ir("application Todo\na Task has a done as boolean default false\n");
  const after = ir("application Todo\na Task has a done as boolean default true\n");
  assert.notEqual(sourceFingerprint(before), sourceFingerprint(after));
  assert.notEqual(semanticFingerprint(before), semanticFingerprint(after));
});

test("semantic manifests separate dependency fingerprints", () => {
  const program = ir("application Todo\na Task has a required title as text\n");
  const manifest = buildSemanticManifest(program, COMPILER_VERSION, {
    shared: "1.0.0"
  });
  assert.equal(manifest.languageVersion, COMPILER_VERSION);
  assert.equal(manifest.irVersion, "0.5.0");
  assert.equal(
    manifest.dependencyFingerprint,
    dependencyFingerprint({ shared: "1.0.0" })
  );
});
