import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, compileSource } from "../src/compiler.js";
import { remapTraceMapSources, buildTraceMap } from "../src/language/trace.js";
import { compileProject } from "../src/language/modules.js";
import { buildManifest } from "../src/manifest.js";

test("modular LaunchOps is semantically identical to the single-file program", async () => {
  const modular = await compileProject("examples/launch-ops-modular.intent");
  const explicit = compileSource(
    await readFile("examples/launch-ops.intent", "utf8")
  );
  assert.equal(modular.ok, true);
  assert.equal(explicit.ok, true);
  if (!modular.ok || !explicit.ok) return;

  assert.equal(canonicalJson(modular.ir), canonicalJson(explicit.ir));
  assert.equal(modular.modules.length, 5);
  assert.equal(Object.keys(modular.dependencies).length, 5);
  assert.notEqual(
    buildManifest(modular.ir, modular.dependencies).dependencyFingerprint,
    buildManifest(explicit.ir).dependencyFingerprint
  );

  const trace = remapTraceMapSources(
    buildTraceMap(modular.source, modular.ir),
    modular.sourceMap
  );
  assert.ok(
    trace.links.some((link) =>
      link.source.file.endsWith("launch-ops-modules\\workflows.intent")
    )
  );
});

test("module resolver rejects cycles, duplicate names, aliases, and missing exports", async () => {
  const directory = await mkdtemp(join(tmpdir(), "intentlang-modules-"));
  try {
    await writeFile(
      join(directory, "root.intent"),
      'import "./a.intent" as A\nimport "./b.intent" as B\n',
      "utf8"
    );
    await writeFile(
      join(directory, "a.intent"),
      'module Example.Shared\nexport all\nimport "./b.intent" as B\napplication Example\n',
      "utf8"
    );
    await writeFile(
      join(directory, "b.intent"),
      'module Example.Other\nexport all\nimport "./a.intent" as A\n',
      "utf8"
    );
    const cycle = await compileProject(join(directory, "root.intent"));
    assert.equal(cycle.ok, false);
    if (!cycle.ok) {
      assert.ok(cycle.diagnostics.some((item) => item.code === "E066"));
    }

    await writeFile(
      join(directory, "root.intent"),
      'import "./a.intent" as Shared\nimport "./b.intent" as Shared\n',
      "utf8"
    );
    const alias = await compileProject(join(directory, "root.intent"));
    assert.equal(alias.ok, false);
    if (!alias.ok) {
      assert.ok(alias.diagnostics.some((item) => item.code === "E067"));
    }

    await writeFile(
      join(directory, "root.intent"),
      'import "./a.intent" as A\nimport "./b.intent" as B\n',
      "utf8"
    );
    await writeFile(
      join(directory, "a.intent"),
      "module Example.Shared\nexport all\napplication Example\n",
      "utf8"
    );
    await writeFile(
      join(directory, "b.intent"),
      "module Example.Shared\nexport all\n",
      "utf8"
    );
    const duplicate = await compileProject(join(directory, "root.intent"));
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) {
      assert.ok(duplicate.diagnostics.some((item) => item.code === "E070"));
    }

    await writeFile(
      join(directory, "b.intent"),
      "module Example.Other\n",
      "utf8"
    );
    const missingExport = await compileProject(join(directory, "root.intent"));
    assert.equal(missingExport.ok, false);
    if (!missingExport.ok) {
      assert.ok(missingExport.diagnostics.some((item) => item.code === "E069"));
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("compiler diagnostics map back to the imported source file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "intentlang-module-map-"));
  try {
    await writeFile(
      join(directory, "root.intent"),
      'import "./broken.intent" as Broken\n',
      "utf8"
    );
    await writeFile(
      join(directory, "broken.intent"),
      "module Example.Broken\nexport all\napplication Broken\nthis is unsupported\n",
      "utf8"
    );
    const result = await compileProject(join(directory, "root.intent"));
    assert.equal(result.ok, false);
    if (!result.ok) {
      const diagnostic = result.diagnostics.find((item) => item.code === "E001");
      assert.ok(diagnostic?.file?.endsWith("broken.intent"));
      assert.equal(diagnostic?.line, 4);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("dependency locks detect module content drift", async () => {
  const directory = await mkdtemp(join(tmpdir(), "intentlang-module-lock-"));
  try {
    const root = join(directory, "root.intent");
    const dependency = join(directory, "task.intent");
    await writeFile(root, 'import "./task.intent" as Task\n', "utf8");
    await writeFile(
      dependency,
      "module Example.Task\nexport all\napplication Locked\n",
      "utf8"
    );
    const initial = await compileProject(root);
    assert.equal(initial.ok, true);
    if (!initial.ok) return;
    await writeFile(join(directory, "root.lock.json"), initial.lock, "utf8");
    await writeFile(
      dependency,
      "module Example.Task\nexport all\napplication Changed\n",
      "utf8"
    );
    const changed = await compileProject(root);
    assert.equal(changed.ok, false);
    if (!changed.ok) {
      assert.ok(changed.diagnostics.some((item) => item.code === "E071"));
    }
    assert.equal((await compileProject(root, { verifyLock: false })).ok, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("projects reject incompatible compiler version requirements", async () => {
  const directory = await mkdtemp(join(tmpdir(), "intentlang-version-"));
  try {
    const root = join(directory, "root.intent");
    await writeFile(
      root,
      "requires IntentLang 1.0\napplication Future\n",
      "utf8"
    );
    const result = await compileProject(root);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.diagnostics.some((item) => item.code === "E072"));
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
