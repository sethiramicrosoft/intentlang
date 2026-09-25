import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, compileSource } from "../src/compiler.js";
import type { BuildManifest } from "../src/model.js";

const showcases = [
  {
    name: "Atlas Grid",
    source: "examples/atlas-grid.intent",
    manifest: "examples/atlas-grid-generated/intentlang.manifest.json",
    entities: 10,
    fields: 49,
    relationships: 21,
    actions: 18,
    roles: 5,
    permissions: 155
  },
  {
    name: "GridShield",
    source: "examples/grid-shield.intent",
    manifest: "examples/grid-shield-generated/intentlang.manifest.json",
    entities: 11,
    fields: 55,
    relationships: 23,
    actions: 24,
    roles: 5,
    permissions: 171
  }
];

for (const showcase of showcases) {
  test(`${showcase.name} compiles to its documented full-stack model`, async () => {
    const source = await readFile(showcase.source, "utf8");
    const result = compileSource(source);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.ir.entities.length, showcase.entities);
    assert.equal(
      result.ir.entities.reduce(
        (total, entity) => total + entity.fields.length,
        0
      ),
      showcase.fields
    );
    assert.equal(result.ir.relationships.length, showcase.relationships);
    assert.equal(result.ir.actions.length, showcase.actions);
    assert.equal(result.ir.roles.length, showcase.roles);
    assert.equal(result.ir.permissions.length, showcase.permissions);
  });

  test(`${showcase.name} generated snapshot matches controlled-English source`, async () => {
    const source = await readFile(showcase.source, "utf8");
    const snapshot = JSON.parse(
      await readFile(showcase.manifest, "utf8")
    ) as BuildManifest;
    const result = compileSource(source);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(canonicalJson(result.ir), canonicalJson(snapshot.ir));
  });
}
