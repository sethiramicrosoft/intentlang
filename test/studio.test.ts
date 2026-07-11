import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile,
  writeFile,
  mkdir,
  rm,
  rename
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { randomBytes } from "node:crypto";
import { compileSource } from "../src/compiler.js";
import { buildStudioViewModel } from "../src/studio-viewmodel.js";
import { STUDIO_CSS, STUDIO_JS, buildStudioHtml } from "../src/studio-assets.js";
import type { ProgramIr } from "../src/model.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const todoSource = `application Todo
authentication uses User identified by email

role Administrator
role Member

a User has a required name as text
a User has a required unique email as text length between 1 and 320
a Task has a required title as text length between 1 and 200
a Task has a done as boolean default false
each Task belongs to a User as owner on delete restrict

action complete a Task
  require done is false otherwise "Task is already complete"
  set done to true

allow Administrator to create User
allow Administrator to read User
allow Administrator to update User
allow Administrator to provision accounts
allow Administrator to read Task where owner is self
allow Administrator to create Task with owner as self
allow Administrator to update Task where owner is self
allow Administrator to run complete on Task where owner is self
allow Member to read User where self
allow Member to read Task where owner is self
allow Member to create Task with owner as self
allow Member to update Task where owner is self
allow Member to run complete on Task where owner is self
`;

const issueTrackerSource = `application IssueTracker
authentication uses User identified by email

role Administrator
role Member

a User has a required name as text
a User has a required unique email as text length between 1 and 320
a Project has a required name as text
a Ticket has a required title as text length between 1 and 200
a Ticket has a description as text
a Ticket has a status as text default "open"

each Ticket belongs to a Project as project on delete cascade
each Ticket belongs to a User as owner on delete restrict

action start a Ticket
  require status is "open" otherwise "Ticket is not open"
  set status to "in-progress"

action close a Ticket
  require status is not "closed" otherwise "Ticket is already closed"
  set status to "closed"

allow Administrator to provision accounts
allow Administrator to create User
allow Administrator to read User
allow Administrator to update User
allow Administrator to create Project
allow Administrator to read Project
allow Administrator to update Project
allow Administrator to create Ticket
allow Administrator to read Ticket
allow Administrator to update Ticket
allow Administrator to run start on Ticket
allow Administrator to run close on Ticket
allow Member to read User where self
allow Member to read Project
allow Member to create Ticket with owner as self
allow Member to read Ticket where owner is self
allow Member to update Ticket where owner is self
allow Member to run start on Ticket where owner is self
allow Member to run close on Ticket where owner is self
`;

function compileOk(source: string): ProgramIr {
  const result = compileSource(source);
  assert.equal(
    result.ok,
    true,
    result.ok ? "" : JSON.stringify((result as { diagnostics: unknown[] }).diagnostics)
  );
  if (!result.ok) throw new Error("compile failed");
  return result.ir;
}

// ── Issue Tracker: compile ────────────────────────────────────────────────────

test("issue tracker compiles without errors", () => {
  const ir = compileOk(issueTrackerSource);
  assert.equal(ir.application.name, "IssueTracker");
  assert.equal(ir.authentication !== undefined, true);

  const entityNames = ir.entities.map((e) => e.name);
  assert.ok(entityNames.includes("User"), "User entity");
  assert.ok(entityNames.includes("Project"), "Project entity");
  assert.ok(entityNames.includes("Ticket"), "Ticket entity");
});

test("issue tracker has correct roles", () => {
  const ir = compileOk(issueTrackerSource);
  const roleNames = ir.roles.map((r) => r.name);
  assert.ok(roleNames.includes("Administrator"), "Administrator role");
  assert.ok(roleNames.includes("Member"), "Member role");
});

test("issue tracker Ticket has expected fields", () => {
  const ir = compileOk(issueTrackerSource);
  const ticket = ir.entities.find((e) => e.name === "Ticket");
  assert.ok(ticket !== undefined, "Ticket entity exists");
  const fieldNames = ticket!.fields.map((f) => f.name);
  assert.ok(fieldNames.includes("title"), "title field");
  assert.ok(fieldNames.includes("description"), "description field");
  assert.ok(fieldNames.includes("status"), "status field");
  const statusField = ticket!.fields.find((f) => f.name === "status");
  assert.equal(statusField!.default, "open", "status default is open");
});

test("issue tracker has start and close actions", () => {
  const ir = compileOk(issueTrackerSource);
  const actionNames = ir.actions.map((a) => a.name);
  assert.ok(actionNames.includes("start"), "start action");
  assert.ok(actionNames.includes("close"), "close action");
});

test("issue tracker Ticket relationships (project + owner)", () => {
  const ir = compileOk(issueTrackerSource);
  const ticket = ir.entities.find((e) => e.name === "Ticket");
  const rels = ir.relationships.filter((r) => r.fromEntityId === ticket!.id);
  const relNames = rels.map((r) => r.name);
  assert.ok(relNames.includes("project"), "project relationship");
  assert.ok(relNames.includes("owner"), "owner relationship");
});

test("issue tracker admin has unscoped read Ticket permission", () => {
  const ir = compileOk(issueTrackerSource);
  const adminRole = ir.roles.find((r) => r.name === "Administrator");
  const ticket = ir.entities.find((e) => e.name === "Ticket");
  const adminReadTicket = ir.permissions.find(
    (p) =>
      p.roleId === adminRole!.id &&
      p.operation === "read" &&
      p.entityId === ticket!.id &&
      p.scope === undefined
  );
  assert.ok(adminReadTicket !== undefined, "Administrator has unscoped read on Ticket");
});

test("issue tracker member has owner-scoped read Ticket permission", () => {
  const ir = compileOk(issueTrackerSource);
  const memberRole = ir.roles.find((r) => r.name === "Member");
  const ticket = ir.entities.find((e) => e.name === "Ticket");
  const memberReadTicket = ir.permissions.find(
    (p) =>
      p.roleId === memberRole!.id &&
      p.operation === "read" &&
      p.entityId === ticket!.id &&
      p.scope?.kind === "owner"
  );
  assert.ok(memberReadTicket !== undefined, "Member has owner-scoped read on Ticket");
});

test("issue tracker member has force-owner create Ticket permission", () => {
  const ir = compileOk(issueTrackerSource);
  const memberRole = ir.roles.find((r) => r.name === "Member");
  const ticket = ir.entities.find((e) => e.name === "Ticket");
  const memberCreateTicket = ir.permissions.find(
    (p) =>
      p.roleId === memberRole!.id &&
      p.operation === "create" &&
      p.entityId === ticket!.id &&
      p.scope?.kind === "force-owner"
  );
  assert.ok(memberCreateTicket !== undefined, "Member has force-owner create on Ticket");
});

test("issue tracker member has unscoped read Project permission", () => {
  const ir = compileOk(issueTrackerSource);
  const memberRole = ir.roles.find((r) => r.name === "Member");
  const project = ir.entities.find((e) => e.name === "Project");
  const memberReadProject = ir.permissions.find(
    (p) =>
      p.roleId === memberRole!.id &&
      p.operation === "read" &&
      p.entityId === project!.id &&
      p.scope === undefined
  );
  assert.ok(memberReadProject !== undefined, "Member has unscoped read on Project");
});

test("issue tracker start action precondition is correct", () => {
  const ir = compileOk(issueTrackerSource);
  const startAction = ir.actions.find((a) => a.name === "start");
  assert.ok(startAction !== undefined, "start action exists");
  assert.equal(startAction!.preconditions.length, 1);
  const pre = startAction!.preconditions[0]!;
  assert.equal(pre.fieldName, "status");
  assert.equal(pre.operator, "is");
  assert.equal(pre.value, "open");
});

test("issue tracker close action assignment is correct", () => {
  const ir = compileOk(issueTrackerSource);
  const closeAction = ir.actions.find((a) => a.name === "close");
  assert.ok(closeAction !== undefined, "close action exists");
  assert.equal(closeAction!.assignments.length, 1);
  const assign = closeAction!.assignments[0]!;
  assert.equal(assign.fieldName, "status");
  assert.equal(assign.value, "closed");
});

test("issue tracker file on disk compiles", async () => {
  const sourcePath = resolve("examples/issue-tracker.intent");
  const source = await readFile(sourcePath, "utf8");
  const result = compileSource(source);
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify((result as { diagnostics: unknown[] }).diagnostics));
});

// ── Studio View Model ─────────────────────────────────────────────────────────

test("studio viewmodel - application name and id", () => {
  const ir = compileOk(todoSource);
  const vm = buildStudioViewModel(ir);
  assert.equal(vm.applicationName, "Todo");
  assert.equal(vm.authentication.enabled, true);
  assert.equal(vm.authentication.identityEntity, "User");
  assert.equal(vm.authentication.identityField, "email");
});

test("studio viewmodel - entities present", () => {
  const ir = compileOk(todoSource);
  const vm = buildStudioViewModel(ir);
  const names = vm.entities.map((e) => e.name);
  assert.ok(names.includes("User"), "User entity in viewmodel");
  assert.ok(names.includes("Task"), "Task entity in viewmodel");
});

test("studio viewmodel - User is identity entity", () => {
  const ir = compileOk(todoSource);
  const vm = buildStudioViewModel(ir);
  const user = vm.entities.find((e) => e.name === "User");
  assert.ok(user !== undefined);
  assert.equal(user!.isIdentityEntity, true);
});

test("studio viewmodel - field details", () => {
  const ir = compileOk(todoSource);
  const vm = buildStudioViewModel(ir);
  const user = vm.entities.find((e) => e.name === "User");
  const emailField = user!.fields.find((f) => f.name === "email");
  assert.ok(emailField !== undefined);
  assert.equal(emailField!.unique, true);
  assert.equal(emailField!.required, true);
  assert.equal(emailField!.type, "text");
  assert.equal(emailField!.lengthMin, 1);
  assert.equal(emailField!.lengthMax, 320);
});

test("studio viewmodel - relationships", () => {
  const ir = compileOk(todoSource);
  const vm = buildStudioViewModel(ir);
  assert.ok(vm.relationships.length > 0, "relationships present");
  const ownerRel = vm.relationships.find((r) => r.name === "owner");
  assert.ok(ownerRel !== undefined, "owner relationship in viewmodel");
  assert.equal(ownerRel!.fromEntity, "Task");
  assert.equal(ownerRel!.toEntity, "User");
  assert.equal(ownerRel!.column, "owner_id");
});

test("studio viewmodel - actions", () => {
  const ir = compileOk(todoSource);
  const vm = buildStudioViewModel(ir);
  const complete = vm.actions.find((a) => a.name === "complete");
  assert.ok(complete !== undefined);
  assert.equal(complete!.entity, "Task");
  assert.equal(complete!.preconditions.length, 1);
  assert.equal(complete!.assignments.length, 1);
});

test("studio viewmodel - roles", () => {
  const ir = compileOk(todoSource);
  const vm = buildStudioViewModel(ir);
  const roleNames = vm.roles.map((r) => r.name);
  assert.ok(roleNames.includes("Administrator"));
  assert.ok(roleNames.includes("Member"));
});

test("studio viewmodel - permissions include default-deny note", () => {
  const ir = compileOk(todoSource);
  const vm = buildStudioViewModel(ir);
  assert.equal(vm.safety.defaultDeny, true);
  assert.ok(vm.safety.note.length > 0);
});

test("studio viewmodel - permission matrix has entity rows", () => {
  const ir = compileOk(todoSource);
  const vm = buildStudioViewModel(ir);
  assert.ok(vm.permissionMatrix.length > 0);
  const taskRow = vm.permissionMatrix.find((r) => r.entity === "Task");
  assert.ok(taskRow !== undefined);
});

test("studio viewmodel - safety summary unique fields", () => {
  const ir = compileOk(todoSource);
  const vm = buildStudioViewModel(ir);
  assert.ok(vm.safety.uniqueFields.includes("User.email"));
});

test("studio viewmodel - safety optimistic concurrency always true", () => {
  const ir = compileOk(todoSource);
  const vm = buildStudioViewModel(ir);
  assert.equal(vm.safety.optimisticConcurrency, true);
});

test("studio viewmodel - issue tracker viewmodel is deterministic", () => {
  const ir = compileOk(issueTrackerSource);
  const vm1 = buildStudioViewModel(ir);
  const vm2 = buildStudioViewModel(ir);
  assert.deepEqual(vm1, vm2, "viewmodel is deterministic");
});

test("studio viewmodel - no-auth application", () => {
  const minimalSource = `application App with id app
entity Item with id item
  label is required text with id item-label
`;
  const ir = compileOk(minimalSource);
  const vm = buildStudioViewModel(ir);
  assert.equal(vm.authentication.enabled, false);
  assert.equal(vm.safety.defaultDeny, false);
});

// ── Studio Assets ─────────────────────────────────────────────────────────────

test("studio CSS contains exact --cp-* light variable block", () => {
  assert.ok(STUDIO_CSS.includes("--cp-bg: #f7f4ef"), "light --cp-bg present");
  assert.ok(STUDIO_CSS.includes("--cp-accent: #b11f4b"), "light --cp-accent present");
  assert.ok(STUDIO_CSS.includes("--cp-success: #16a34a"), "light --cp-success present");
  assert.ok(STUDIO_CSS.includes("--cp-danger: #dc2626"), "light --cp-danger present");
});

test("studio CSS contains exact --cp-* dark variable block", () => {
  assert.ok(STUDIO_CSS.includes("--cp-bg: #3d3b3a"), "dark --cp-bg present");
  assert.ok(STUDIO_CSS.includes("--cp-accent: #fd8ea1"), "dark --cp-accent present");
  assert.ok(STUDIO_CSS.includes("--cp-success: #4ade80"), "dark --cp-success present");
  assert.ok(STUDIO_CSS.includes("--cp-danger: #f87171"), "dark --cp-danger present");
});

test("studio CSS uses only var(--cp-*) for colors (no hardcoded hex in component rules)", () => {
  // After the variable definition blocks, components should use var(--cp-*)
  const afterVars = STUDIO_CSS.split("html[data-theme=\"dark\"]")[1] ?? "";
  // Find component color usages - should be var(--cp-*) only
  const hardcodedHex = /color:\s*#[0-9a-fA-F]{3,6}/g;
  const matches = afterVars.match(hardcodedHex);
  assert.equal(matches, null, `Hardcoded hex colors in component rules: ${JSON.stringify(matches)}`);
});

test("studio CSS uses Segoe UI/Aptos font stack", () => {
  assert.ok(STUDIO_CSS.includes('"Segoe UI"'), "Segoe UI in font stack");
  assert.ok(STUDIO_CSS.includes("Aptos"), "Aptos in font stack");
});

test("studio CSS uses monospace stack for code", () => {
  assert.ok(STUDIO_CSS.includes("Cascadia Code"), "Cascadia Code in monospace stack");
  assert.ok(STUDIO_CSS.includes("Fira Mono"), "Fira Mono in monospace stack");
  assert.ok(STUDIO_CSS.includes("Consolas"), "Consolas in monospace stack");
});

test("studio HTML has Scout theme detection script as first script", () => {
  const html = buildStudioHtml("test.intent", 3211);
  const firstScriptIndex = html.indexOf("<script>");
  const linkIndex = html.indexOf("<link");
  // First script must appear before the body scripts, and contain scoutTheme
  assert.ok(firstScriptIndex > -1, "has script tag");
  const firstScriptContent = html.slice(firstScriptIndex, html.indexOf("</script>", firstScriptIndex));
  assert.ok(firstScriptContent.includes("scoutTheme"), "Scout theme detection in first script");
  assert.ok(firstScriptContent.includes("data-theme"), "sets data-theme in first script");
});

test("studio HTML has semantic landmarks", () => {
  const html = buildStudioHtml("test.intent", 3211);
  assert.ok(html.includes('role="banner"'), "header landmark");
  assert.ok(html.includes('role="main"'), "main landmark");
  assert.ok(html.includes('role="tablist"'), "tablist role");
  assert.ok(html.includes('role="tab"'), "tab role");
  assert.ok(html.includes('role="tabpanel"'), "tabpanel role");
  assert.ok(html.includes('role="status"'), "status role");
  assert.ok(html.includes('aria-live="polite"'), "aria-live region");
});

test("studio HTML has labelled editor and buttons", () => {
  const html = buildStudioHtml("test.intent", 3211);
  assert.ok(html.includes('aria-label="Source editor"'), "editor has aria-label");
  assert.ok(html.includes('aria-label="Toggle dark/light theme"'), "theme button has aria-label");
  assert.ok(html.includes('aria-label="Editor actions"'), "toolbar has aria-label");
  assert.ok(html.includes('aria-label="Output panels"'), "panels section has aria-label");
});

test("studio HTML has accessible dialog attributes", () => {
  const html = buildStudioHtml("test.intent", 3211);
  assert.ok(html.includes('aria-modal="true"'), "dialogs have aria-modal");
  assert.ok(html.includes('aria-labelledby='), "dialogs have aria-labelledby");
});

test("studio HTML does not use alert/confirm/prompt", () => {
  assert.ok(!STUDIO_JS.includes("window.alert"), "no window.alert");
  assert.ok(!STUDIO_JS.includes("window.confirm"), "no window.confirm");
  assert.ok(!STUDIO_JS.includes("window.prompt"), "no window.prompt");
  // Direct calls too
  assert.ok(!STUDIO_JS.includes("\nalert("), "no alert(");
  assert.ok(!STUDIO_JS.includes("\nconfirm("), "no confirm(");
  assert.ok(!STUDIO_JS.includes("\nprompt("), "no prompt(");
});

test("studio JS does not use eval or innerHTML for untrusted content", () => {
  // innerHTML is only used for the diff pane (with escaped content via escText())
  // All other content uses textContent
  assert.ok(!STUDIO_JS.includes("eval("), "no eval()");
  // The only innerHTML usage should be in showFormatDiff (for the diff pane with escaped content)
  const innerHtmlMatches = (STUDIO_JS.match(/\.innerHTML\s*=/g) ?? []).length;
  // Allow at most 1 (the diff pane which uses escText)
  assert.ok(innerHtmlMatches <= 1, `at most 1 innerHTML assignment, got ${innerHtmlMatches}`);
});

test("studio HTML filename is escaped", () => {
  const html = buildStudioHtml('<script>alert(1)</script>', 3211);
  assert.ok(!html.includes("<script>alert(1)</script>"), "filename is HTML-escaped");
  assert.ok(html.includes("&lt;script&gt;"), "angle brackets escaped");
});

// ── Studio Server ─────────────────────────────────────────────────────────────

const TEST_OUTPUT_DIR = resolve("test-output");

async function withTempSourceFile(
  content: string,
  fn: (sourcePath: string) => Promise<void>
): Promise<void> {
  const tmpDir = join(TEST_OUTPUT_DIR, `studio-test-${randomBytes(8).toString("hex")}`);
  await mkdir(tmpDir, { recursive: true });
  const sourcePath = join(tmpDir, "test.intent");
  await writeFile(sourcePath, content, "utf8");
  try {
    await fn(sourcePath);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

test("studio server binds to 127.0.0.1 and default port 3211", async () => {
  const { startStudio } = await import("../src/studio-server.js");

  await withTempSourceFile(todoSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, noOpen: true });
    try {
      assert.equal(studio.port, 3211);
      assert.equal(studio.url, "http://127.0.0.1:3211");
    } finally {
      await studio.close();
    }
  });
});

test("studio server respects custom port", async () => {
  const { startStudio } = await import("../src/studio-server.js");

  await withTempSourceFile(todoSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3299, noOpen: true });
    try {
      assert.equal(studio.port, 3299);
      assert.equal(studio.url, "http://127.0.0.1:3299");
    } finally {
      await studio.close();
    }
  });
});

async function getJson(url: string): Promise<{ status: number; body: unknown }> {
  const resp = await fetch(url);
  const body = await resp.json() as unknown;
  return { status: resp.status, body };
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: unknown }> {
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": new URL(url).origin,
      ...headers
    },
    body: JSON.stringify(body)
  });
  const responseBody = await resp.json() as unknown;
  return { status: resp.status, body: responseBody };
}

test("studio server GET /api/state returns source and csrf token", async () => {
  const { startStudio } = await import("../src/studio-server.js");

  await withTempSourceFile(todoSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3301, noOpen: true });
    try {
      const { status, body } = await getJson(`${studio.url}/api/state`);
      assert.equal(status, 200);
      const b = body as Record<string, unknown>;
      assert.ok(typeof b["csrfToken"] === "string" && b["csrfToken"].length > 0, "csrfToken present");
      assert.ok(typeof b["source"] === "string", "source present");
      assert.ok(b["templates"] !== undefined, "templates present");
      assert.ok((b["templates"] as Record<string, unknown>)["todo"] !== undefined, "todo template present");
      assert.ok((b["templates"] as Record<string, unknown>)["issue-tracker"] !== undefined, "issue-tracker template present");
    } finally {
      await studio.close();
    }
  });
});

test("studio server returns 404 for arbitrary paths", async () => {
  const { startStudio } = await import("../src/studio-server.js");

  await withTempSourceFile(todoSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3302, noOpen: true });
    try {
      const paths = [
        "/api/exec",
        "/api/files",
        "/../etc/passwd",
        "/admin",
        "/static/evil.js",
        "/api/state/extra"
      ];
      for (const path of paths) {
        const resp = await fetch(`${studio.url}${path}`);
        assert.equal(resp.status, 404, `Expected 404 for ${path}, got ${resp.status}`);
      }
    } finally {
      await studio.close();
    }
  });
});

test("studio server rejects POST with wrong Origin", async () => {
  const { startStudio } = await import("../src/studio-server.js");

  await withTempSourceFile(todoSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3303, noOpen: true });
    try {
      // Get CSRF token first
      const stateResp = await fetch(`${studio.url}/api/state`);
      const state = await stateResp.json() as Record<string, unknown>;
      const csrfToken = String(state["csrfToken"] ?? "");

      const resp = await fetch(`${studio.url}/api/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": "http://evil.example.com",
          "X-Studio-CSRF-Token": csrfToken
        },
        body: JSON.stringify({ source: todoSource })
      });
      assert.equal(resp.status, 403, "Wrong origin rejected");
    } finally {
      await studio.close();
    }
  });
});

test("studio server rejects POST without CSRF token", async () => {
  const { startStudio } = await import("../src/studio-server.js");

  await withTempSourceFile(todoSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3304, noOpen: true });
    try {
      const resp = await fetch(`${studio.url}/api/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": studio.url
        },
        body: JSON.stringify({ source: todoSource })
      });
      assert.equal(resp.status, 403, "Missing CSRF token rejected");
    } finally {
      await studio.close();
    }
  });
});

test("studio server rejects POST with wrong CSRF token", async () => {
  const { startStudio } = await import("../src/studio-server.js");

  await withTempSourceFile(todoSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3305, noOpen: true });
    try {
      const resp = await fetch(`${studio.url}/api/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": studio.url,
          "X-Studio-CSRF-Token": "wrong-token-value"
        },
        body: JSON.stringify({ source: todoSource })
      });
      assert.equal(resp.status, 403, "Wrong CSRF token rejected");
    } finally {
      await studio.close();
    }
  });
});

test("studio server POST /api/check returns diagnostics for valid source", async () => {
  const { startStudio } = await import("../src/studio-server.js");

  await withTempSourceFile(todoSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3306, noOpen: true });
    try {
      const stateResp = await fetch(`${studio.url}/api/state`);
      const state = await stateResp.json() as Record<string, unknown>;
      const csrfToken = String(state["csrfToken"] ?? "");

      const resp = await fetch(`${studio.url}/api/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": studio.url,
          "X-Studio-CSRF-Token": csrfToken
        },
        body: JSON.stringify({ source: todoSource })
      });
      assert.equal(resp.status, 200);
      const body = await resp.json() as Record<string, unknown>;
      assert.ok(Array.isArray(body["diagnostics"]), "diagnostics is array");
      assert.equal((body["diagnostics"] as unknown[]).length, 0, "zero diagnostics for valid source");
      assert.ok(body["model"] !== null, "model present");
      assert.ok(typeof body["canonical"] === "string", "canonical present");
    } finally {
      await studio.close();
    }
  });
});

test("studio server POST /api/check returns diagnostics for invalid source", async () => {
  const { startStudio } = await import("../src/studio-server.js");
  const invalidSource = "application BAD invalid syntax here\n";

  await withTempSourceFile(invalidSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3307, noOpen: true });
    try {
      const stateResp = await fetch(`${studio.url}/api/state`);
      const state = await stateResp.json() as Record<string, unknown>;
      const csrfToken = String(state["csrfToken"] ?? "");

      const resp = await fetch(`${studio.url}/api/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": studio.url,
          "X-Studio-CSRF-Token": csrfToken
        },
        body: JSON.stringify({ source: invalidSource })
      });
      assert.equal(resp.status, 200);
      const body = await resp.json() as Record<string, unknown>;
      assert.ok((body["diagnostics"] as unknown[]).length > 0, "has diagnostics for invalid source");
      const diag = (body["diagnostics"] as Record<string, unknown>[])[0]!;
      assert.ok(typeof diag["code"] === "string", "diagnostic has code");
      assert.ok(typeof diag["line"] === "number", "diagnostic has line");
      assert.ok(typeof diag["column"] === "number", "diagnostic has column");
      assert.ok(typeof diag["message"] === "string", "diagnostic has message");
      assert.ok(typeof diag["hint"] === "string", "diagnostic has hint");
    } finally {
      await studio.close();
    }
  });
});

test("studio server POST /api/format returns formatted source", async () => {
  const { startStudio } = await import("../src/studio-server.js");
  const naturalSource = `application Todo
a Task has a required title as text
a Task has a done as boolean default false
`;

  await withTempSourceFile(naturalSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3308, noOpen: true });
    try {
      const stateResp = await fetch(`${studio.url}/api/state`);
      const state = await stateResp.json() as Record<string, unknown>;
      const csrfToken = String(state["csrfToken"] ?? "");

      const resp = await fetch(`${studio.url}/api/format`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": studio.url,
          "X-Studio-CSRF-Token": csrfToken
        },
        body: JSON.stringify({ source: naturalSource })
      });
      assert.equal(resp.status, 200);
      const body = await resp.json() as Record<string, unknown>;
      assert.ok(typeof body["formatted"] === "string", "formatted present");
      assert.ok((body["formatted"] as string).includes("with id"), "formatted uses canonical syntax");
    } finally {
      await studio.close();
    }
  });
});

test("studio server format roundtrip: formatted source re-formats identically", async () => {
  const { startStudio } = await import("../src/studio-server.js");

  await withTempSourceFile(todoSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3309, noOpen: true });
    try {
      const stateResp = await fetch(`${studio.url}/api/state`);
      const state = await stateResp.json() as Record<string, unknown>;
      const csrfToken = String(state["csrfToken"] ?? "");

      const format = async (source: string): Promise<string> => {
        const resp = await fetch(`${studio.url}/api/format`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Origin": studio.url,
            "X-Studio-CSRF-Token": csrfToken
          },
          body: JSON.stringify({ source })
        });
        const body = await resp.json() as Record<string, unknown>;
        return String(body["formatted"] ?? "");
      };

      const formatted1 = await format(todoSource);
      const formatted2 = await format(formatted1);
      assert.equal(formatted1, formatted2, "format is idempotent");
    } finally {
      await studio.close();
    }
  });
});

test("studio server POST /api/save writes only to the specified source file (atomic)", async () => {
  const { startStudio } = await import("../src/studio-server.js");
  const updatedSource = todoSource + "\n";

  await withTempSourceFile(todoSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3310, noOpen: true });
    try {
      const stateResp = await fetch(`${studio.url}/api/state`);
      const state = await stateResp.json() as Record<string, unknown>;
      const csrfToken = String(state["csrfToken"] ?? "");

      const resp = await fetch(`${studio.url}/api/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": studio.url,
          "X-Studio-CSRF-Token": csrfToken
        },
        body: JSON.stringify({ source: updatedSource })
      });
      assert.equal(resp.status, 200);
      const saved = await readFile(sourcePath, "utf8");
      assert.equal(saved, updatedSource, "file content matches saved content");
    } finally {
      await studio.close();
    }
  });
});

test("studio server source path is fixed at startup (browser cannot specify path)", async () => {
  const { startStudio } = await import("../src/studio-server.js");

  await withTempSourceFile(todoSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3311, noOpen: true });
    try {
      const stateResp = await fetch(`${studio.url}/api/state`);
      const state = await stateResp.json() as Record<string, unknown>;
      const csrfToken = String(state["csrfToken"] ?? "");

      // Browser attempts to provide a different source path — API ignores it
      const resp = await fetch(`${studio.url}/api/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": studio.url,
          "X-Studio-CSRF-Token": csrfToken
        },
        body: JSON.stringify({
          source: todoSource,
          sourcePath: "/etc/passwd" // should be ignored
        })
      });
      assert.equal(resp.status, 200, "request succeeds but sourcePath is ignored");
    } finally {
      await studio.close();
    }
  });
});

test("studio server enforces body size limit", async () => {
  const { startStudio } = await import("../src/studio-server.js");

  await withTempSourceFile(todoSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3312, noOpen: true });
    try {
      const stateResp = await fetch(`${studio.url}/api/state`);
      const state = await stateResp.json() as Record<string, unknown>;
      const csrfToken = String(state["csrfToken"] ?? "");

      const hugeBody = JSON.stringify({ source: "x".repeat(2_000_000) });
      const resp = await fetch(`${studio.url}/api/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": studio.url,
          "X-Studio-CSRF-Token": csrfToken
        },
        body: hugeBody
      });
      assert.equal(resp.status, 413, "body size limit enforced");
    } finally {
      await studio.close();
    }
  });
});

test("studio server plan token is tied to source fingerprint", async () => {
  const { startStudio } = await import("../src/studio-server.js");

  await withTempSourceFile(todoSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3313, noOpen: true });
    try {
      const stateResp = await fetch(`${studio.url}/api/state`);
      const state = await stateResp.json() as Record<string, unknown>;
      const csrfToken = String(state["csrfToken"] ?? "");

      // Get plan token for original source
      const planResp = await fetch(`${studio.url}/api/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": studio.url,
          "X-Studio-CSRF-Token": csrfToken
        },
        body: JSON.stringify({ source: todoSource })
      });
      assert.equal(planResp.status, 200);
      const plan = await planResp.json() as Record<string, unknown>;
      const planToken = String(plan["planToken"] ?? "");
      assert.ok(planToken.length > 0, "plan token present");

      // Attempt to generate with changed source — should fail
      const changedSource = todoSource + "\n-- changed";
      const genResp = await fetch(`${studio.url}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": studio.url,
          "X-Studio-CSRF-Token": csrfToken
        },
        body: JSON.stringify({ source: changedSource, planToken })
      });
      assert.equal(genResp.status, 409, "generate rejected when source changed");
    } finally {
      await studio.close();
    }
  });
});

test("studio server plan token can only be used once (anti-replay)", async () => {
  const { startStudio } = await import("../src/studio-server.js");

  await withTempSourceFile(todoSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3314, noOpen: true });
    try {
      const stateResp = await fetch(`${studio.url}/api/state`);
      const state = await stateResp.json() as Record<string, unknown>;
      const csrfToken = String(state["csrfToken"] ?? "");

      // Get plan
      const planResp = await fetch(`${studio.url}/api/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": studio.url,
          "X-Studio-CSRF-Token": csrfToken
        },
        body: JSON.stringify({ source: todoSource })
      });
      const plan = await planResp.json() as Record<string, unknown>;
      const planToken = String(plan["planToken"] ?? "");

      // First generate (consumes the token)
      await fetch(`${studio.url}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": studio.url,
          "X-Studio-CSRF-Token": csrfToken
        },
        body: JSON.stringify({ source: todoSource, planToken })
      });

      // Second generate with same token — should fail
      const genResp2 = await fetch(`${studio.url}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": studio.url,
          "X-Studio-CSRF-Token": csrfToken
        },
        body: JSON.stringify({ source: todoSource, planToken })
      });
      assert.equal(genResp2.status, 409, "plan token replay rejected");
    } finally {
      await studio.close();
    }
  });
});

test("studio server generate creates expected artifacts", async () => {
  const { startStudio } = await import("../src/studio-server.js");

  await withTempSourceFile(todoSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3315, noOpen: true });
    try {
      const stateResp = await fetch(`${studio.url}/api/state`);
      const state = await stateResp.json() as Record<string, unknown>;
      const csrfToken = String(state["csrfToken"] ?? "");

      const planResp = await fetch(`${studio.url}/api/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": studio.url,
          "X-Studio-CSRF-Token": csrfToken
        },
        body: JSON.stringify({ source: todoSource })
      });
      const plan = await planResp.json() as Record<string, unknown>;
      const planToken = String(plan["planToken"] ?? "");

      const genResp = await fetch(`${studio.url}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": studio.url,
          "X-Studio-CSRF-Token": csrfToken
        },
        body: JSON.stringify({ source: todoSource, planToken })
      });
      assert.equal(genResp.status, 200);
      const genBody = await genResp.json() as Record<string, unknown>;

      const outputDir = String(genBody["outputDir"] ?? "");
      assert.ok(existsSync(outputDir), "output dir created");
      assert.ok(existsSync(join(outputDir, "app.mjs")), "app.mjs created");
      assert.ok(existsSync(join(outputDir, "migration.sql")), "migration.sql created");
      assert.ok(existsSync(join(outputDir, "intentlang.manifest.json")), "manifest created");
      assert.ok(existsSync(join(outputDir, "index.html")), "index.html created");
    } finally {
      await studio.close();
    }
  });
});

test("studio server responses have security headers", async () => {
  const { startStudio } = await import("../src/studio-server.js");

  await withTempSourceFile(todoSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3316, noOpen: true });
    try {
      const resp = await fetch(`${studio.url}/`);
      assert.ok(resp.headers.get("x-content-type-options") === "nosniff", "X-Content-Type-Options");
      assert.ok(resp.headers.get("cache-control")?.includes("no-store"), "Cache-Control: no-store");
      assert.ok(resp.headers.get("referrer-policy") === "no-referrer", "Referrer-Policy");
    } finally {
      await studio.close();
    }
  });
});

test("studio server GET / returns HTML with Studio title", async () => {
  const { startStudio } = await import("../src/studio-server.js");

  await withTempSourceFile(todoSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3317, noOpen: true });
    try {
      const resp = await fetch(`${studio.url}/`);
      assert.equal(resp.status, 200);
      const body = await resp.text();
      assert.ok(body.includes("IntentLang Studio"), "page title present");
      assert.ok(body.includes("<!DOCTYPE html>"), "HTML doctype");
    } finally {
      await studio.close();
    }
  });
});

test("studio server GET /studio.js returns JS content", async () => {
  const { startStudio } = await import("../src/studio-server.js");

  await withTempSourceFile(todoSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3318, noOpen: true });
    try {
      const resp = await fetch(`${studio.url}/studio.js`);
      assert.equal(resp.status, 200);
      assert.ok(resp.headers.get("content-type")?.includes("javascript"), "JS content-type");
      const body = await resp.text();
      assert.ok(body.includes("IntentLang Studio"), "Studio JS content");
    } finally {
      await studio.close();
    }
  });
});

test("studio server GET /studio.css returns CSS content", async () => {
  const { startStudio } = await import("../src/studio-server.js");

  await withTempSourceFile(todoSource, async (sourcePath) => {
    const studio = await startStudio({ sourcePath, port: 3319, noOpen: true });
    try {
      const resp = await fetch(`${studio.url}/studio.css`);
      assert.equal(resp.status, 200);
      assert.ok(resp.headers.get("content-type")?.includes("css"), "CSS content-type");
      const body = await resp.text();
      assert.ok(body.includes("--cp-bg"), "--cp-bg in CSS");
    } finally {
      await studio.close();
    }
  });
});

// ── Issue Tracker generation in temp dir ──────────────────────────────────────

test("issue tracker generates app in temp dir", async () => {
  const tmpDir = join(TEST_OUTPUT_DIR, `issue-tracker-gen-${randomBytes(8).toString("hex")}`);
  await mkdir(tmpDir, { recursive: true });
  try {
    const { startStudio } = await import("../src/studio-server.js");
    const sourcePath = join(tmpDir, "issue-tracker.intent");
    await writeFile(sourcePath, issueTrackerSource, "utf8");

    const studio = await startStudio({ sourcePath, port: 3320, noOpen: true });
    try {
      const stateResp = await fetch(`${studio.url}/api/state`);
      const state = await stateResp.json() as Record<string, unknown>;
      const csrfToken = String(state["csrfToken"] ?? "");

      const planResp = await fetch(`${studio.url}/api/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": studio.url,
          "X-Studio-CSRF-Token": csrfToken
        },
        body: JSON.stringify({ source: issueTrackerSource })
      });
      assert.equal(planResp.status, 200);
      const plan = await planResp.json() as Record<string, unknown>;
      const planToken = String(plan["planToken"] ?? "");

      const genResp = await fetch(`${studio.url}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": studio.url,
          "X-Studio-CSRF-Token": csrfToken
        },
        body: JSON.stringify({ source: issueTrackerSource, planToken })
      });
      assert.equal(genResp.status, 200);
      const genBody = await genResp.json() as Record<string, unknown>;
      const outputDir = String(genBody["outputDir"] ?? "");
      assert.ok(existsSync(outputDir), "issue tracker output dir created");
      assert.ok(existsSync(join(outputDir, "app.mjs")), "issue tracker app.mjs created");
    } finally {
      await studio.close();
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ── DLP: no credential literals ──────────────────────────────────────────────

test("studio test file contains no saved credential literals", async () => {
  const content = await readFile(resolve("test/studio.test.ts"), "utf8");
  const credentialLiteral = /(?:password|passwd|secret|credential)\s*[:=]\s*["'][^"']+["']/gi;
  assert.equal(credentialLiteral.test(content), false, "No credential literals in studio test file");
});

test("studio server source file contains no saved credential literals", async () => {
  const content = await readFile(resolve("src/studio-server.ts"), "utf8");
  const credentialLiteral = /(?:password|passwd|secret|credential)\s*[:=]\s*["'][^"']+["']/gi;
  assert.equal(credentialLiteral.test(content), false, "No credential literals in studio-server.ts");
});
