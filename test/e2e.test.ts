import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID } from "node:crypto";
import { compileSource } from "../src/compiler.js";
import { generateSchema } from "../src/generator.js";
import { buildManifest } from "../src/manifest.js";
import { generateUi } from "../src/ui-codegen.js";
import { generateRuntime } from "../src/runtime-codegen.js";
import { canonicalJson } from "../src/compiler.js";

const repoRoot = resolve(process.cwd());
const workRoot = join(repoRoot, "test-output");

function ephemeralAuthInput(): string {
  return `${randomBytes(24).toString("base64url")}Aa1!`;
}

const bootstrapAuthInput = ephemeralAuthInput();
const invalidAuthInput = ephemeralAuthInput();
const aliceAuthInput = ephemeralAuthInput();
const bobAuthInput = ephemeralAuthInput();
const evilAuthInput = ephemeralAuthInput();
const carolAuthInput = ephemeralAuthInput();

const source = `application Todo with id todo
authentication uses User identified by email
role Administrator with id administrator
role Member with id member

entity User with id user
  name is required text with id user-name
  email is required unique text with id user-email

entity Task with id task
  title is required text with id task-title
  done is boolean with id task-done default false

Task belongs to User as owner with id task-owner on delete restrict

action complete a Task with id task-complete
  require done is false otherwise "Task is already complete"
  set done to true

allow Administrator to create User
allow Administrator to create Task
allow Administrator to provision accounts
allow Administrator to read Task
allow Administrator to update Task
allow Administrator to run complete on Task
allow Member to read User where self
allow Member to read Task where owner is self
allow Member to update Task where owner is self
allow Member to create Task with owner as self
allow Member to run complete on Task where owner is self
`;

function compileOk() {
  const result = compileSource(source);
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result.diagnostics));
  if (!result.ok) throw new Error("compile failed");
  return result.ir;
}

async function createWorkspace(): Promise<string> {
  await mkdir(workRoot, { recursive: true });
  return mkdtemp(join(workRoot, "auth-e2e-"));
}

async function writeGeneratedApp(dir: string): Promise<void> {
  const ir = compileOk();
  const manifest = buildManifest(ir);
  const ui = generateUi(ir);
  const runtime = generateRuntime(ir, manifest, ui);
  await writeFile(join(dir, "migration.sql"), generateSchema(ir).migrationSql, "utf8");
  await writeFile(join(dir, "intentlang.manifest.json"), canonicalJson(manifest) + "\n", "utf8");
  await writeFile(join(dir, "app.mjs"), runtime.appMjs, "utf8");
  await writeFile(join(dir, "index.html"), ui.indexHtml, "utf8");
  await writeFile(join(dir, "app.js"), ui.appJs, "utf8");
  await writeFile(join(dir, "styles.css"), ui.stylesCss, "utf8");
  await writeFile(join(dir, "package.json"), runtime.packageJson, "utf8");
}

async function startServer(
  dir: string,
  env: Record<string, string> = {}
): Promise<{ child: ChildProcess; baseUrl: string; stderr: () => string }> {
  const port = 4200 + Math.floor(Math.random() * 800);
  let stderrBuffer = "";
  const child = spawn(process.execPath, ["app.mjs"], {
    cwd: dir,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(port),
      INTENTLANG_BOOTSTRAP_NAME: "Admin User",
      INTENTLANG_BOOTSTRAP_EMAIL: "admin@example.com",
      INTENTLANG_BOOTSTRAP_PASSWORD: bootstrapAuthInput,
      ...env
    }
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  child.stderr?.on("data", (chunk) => { stderrBuffer += String(chunk); });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) {
      const err = await readStream(child.stderr);
      throw new Error(`server exited early (code ${child.exitCode}): ${stderrBuffer}${err}`);
    }
    try {
      const res = await fetch(`${baseUrl}/`);
      if (res.ok) return { child, baseUrl, stderr: () => stderrBuffer };
    } catch {
      // retry
    }
    await delay(100);
  }
  throw new Error("server did not start");
}

async function readStream(stream: NodeJS.ReadableStream | null): Promise<string> {
  if (!stream) return "";
  const chunks: string[] = [];
  stream.on("data", (chunk) => chunks.push(String(chunk)));
  await delay(100);
  return chunks.join("");
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill();
  await new Promise<void>((res) => {
    child.once("exit", () => res());
    setTimeout(() => res(), 1000);
  });
}

function tableColumns(db: DatabaseSync, tableName: string): string[] {
  return (db.prepare(`PRAGMA table_info("${tableName}")`).all() as Array<{ name: string }>).map((row) => row.name);
}

interface SessionState {
  cookie: string;
  csrf: string;
  identityId: string;
  roleId: string;
  identityEmail: string;
  identityName: string;
  permissions: Array<{ operation: string; entityId?: string; actionId?: string }>;
}

async function login(baseUrl: string, email: string, password: string): Promise<SessionState> {
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({ email, password })
  });
  assert.equal(loginRes.status, 200, `Login failed for ${email}: ${loginRes.status}`);
  const loginBody = (await loginRes.json()) as {
    identity_id: string;
    role_id: string;
    identity_email: string;
    identity_name: string;
    csrf_token: string;
  };
  const cookieHeader = loginRes.headers.get("set-cookie");
  assert.ok(cookieHeader, "Expected Set-Cookie header");
  const cookie = cookieHeader.split(";")[0]!;
  const meRes = await fetch(`${baseUrl}/auth/me`, { headers: { Cookie: cookie } });
  assert.equal(meRes.status, 200);
  const me = (await meRes.json()) as {
    identity_id: string;
    role_id: string;
    csrf_token: string;
    identity_email: string;
    identity_name: string;
    permissions?: Array<{ operation: string; entityId?: string; actionId?: string }>;
  };
  assert.equal(me.csrf_token, loginBody.csrf_token, "Immediate /auth/me must return the same CSRF token");
  assert.equal(me.identity_id, loginBody.identity_id);
  assert.equal(me.role_id, loginBody.role_id);
  assert.equal(me.identity_email, loginBody.identity_email);
  assert.equal(me.identity_name, loginBody.identity_name);
  assert.ok(me.csrf_token, "Expected csrf_token in /auth/me response");
  return {
    cookie,
    csrf: me.csrf_token,
    identityId: me.identity_id,
    roleId: me.role_id,
    identityEmail: me.identity_email,
    identityName: me.identity_name,
    permissions: me.permissions ?? []
  };
}

// ── Bootstrap failure (missing env) ──────────────────────────────────────────

test("bootstrap refusal - server exits when bootstrap vars missing", async () => {
  const workspace = await createWorkspace();
  try {
    await writeGeneratedApp(workspace);
    const child = spawn(process.execPath, ["app.mjs"], {
      cwd: workspace,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PORT: String(4200 + Math.floor(Math.random() * 800)),
        INTENTLANG_BOOTSTRAP_NAME: "",
        INTENTLANG_BOOTSTRAP_EMAIL: "",
        INTENTLANG_BOOTSTRAP_PASSWORD: ""
      }
    });
    let stderrOut = "";
    child.stderr?.on("data", (chunk) => { stderrOut += String(chunk); });
    const exitCode = await new Promise<number | null>((res) => {
      child.once("exit", (code) => res(code));
      setTimeout(() => { child.kill(); res(null); }, 5000);
    });
    assert.notEqual(exitCode, 0, "Expected non-zero exit when bootstrap vars missing");
    assert.ok(
      stderrOut.includes("ERROR: No accounts exist. Set INTENTLANG_BOOTSTRAP_NAME, INTENTLANG_BOOTSTRAP_EMAIL, and INTENTLANG_BOOTSTRAP_PASSWORD to create the first Administrator account."),
      `Expected exact bootstrap error message, got: ${stderrOut.slice(0, 300)}`
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

// ── Main auth E2E suite (shared server) ──────────────────────────────────────

test("auth runtime end-to-end", async (t) => {
  const workspace = await createWorkspace();
  let child: ChildProcess | undefined;
  let baseUrl = "";
  let stderrFn: () => string = () => "";
  let adminSession!: SessionState;
  let aliceSession!: SessionState;
  let aliceTask!: { id: string; version: number };
  let bobSession!: SessionState;
  let bobTask!: { id: string; version: number };
  let aliceActionReplay!: { key: string; response: { data: { id: string; version: number; done: number } } };

  try {
    await writeGeneratedApp(workspace);
    const started = await startServer(workspace);
    child = started.child;
    baseUrl = started.baseUrl;
    stderrFn = started.stderr;

    // ── bootstrap no secret output ───────────────────────────────────────────
    await t.test("bootstrap no secret output - no password or token in stdout/stderr", async () => {
      const stderr = stderrFn();
      assert.ok(!stderr.includes(bootstrapAuthInput), "Bootstrap password must not appear in stderr");
      assert.ok(!stderr.toLowerCase().includes("password"), "Password string must not appear in bootstrap output");
    });

    // ── generic bad login ────────────────────────────────────────────────────
    await t.test("generic bad login - returns 401 with INVALID_CREDENTIALS", async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({ email: "admin@example.com", password: invalidAuthInput })
      });
      assert.equal(res.status, 401);
      const body = (await res.json()) as { error: string };
      assert.equal(body.error, "INVALID_CREDENTIALS");
    });

    // ── cookie + CSRF roundtrip ──────────────────────────────────────────────
    await t.test("cookie + CSRF - login sets HttpOnly cookie", async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({ email: "admin@example.com", password: bootstrapAuthInput })
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        identity_id: string;
        role_id: string;
        identity_email: string;
        identity_name: string;
        csrf_token: string;
      };
      assert.equal(body.identity_email, "admin@example.com");
      assert.equal(body.identity_name, "Admin User");
      assert.equal(body.role_id, "administrator");
      assert.ok(body.identity_id);
      assert.ok(body.csrf_token);
      const setCookie = res.headers.get("set-cookie") ?? "";
      assert.ok(setCookie.includes("HttpOnly"), "Session cookie must be HttpOnly");
      assert.ok(setCookie.includes("SameSite=Strict"), "Cookie must have SameSite=Strict");
      assert.ok(setCookie.includes("Max-Age=28800"), "Cookie must have Max-Age=28800");
      assert.ok(setCookie.includes("session="), "Cookie name must be session");
    });

    // ── /me response ─────────────────────────────────────────────────────────
    await t.test("/me - returns csrf_token, identity, role, permissions", async () => {
      adminSession = await login(baseUrl, "admin@example.com", bootstrapAuthInput);
      assert.ok(adminSession.csrf, "Expected csrf_token");
      assert.ok(adminSession.identityId, "Expected identity id");
      assert.equal(adminSession.roleId, "administrator");
      assert.equal(adminSession.identityEmail, "admin@example.com");
      assert.equal(adminSession.identityName, "Admin User");
      assert.ok(Array.isArray(adminSession.permissions), "Expected permissions array");
    });

    await t.test("runtime tables - exact auth internal columns", async () => {
      const db = new DatabaseSync(join(workspace, "app.sqlite"));
      assert.deepEqual(tableColumns(db, "__intentlang_accounts"), [
        "identity_id",
        "role_id",
        "password_salt",
        "password_hash",
        "scrypt_n",
        "scrypt_r",
        "scrypt_p",
        "scrypt_keylen",
        "password_version",
        "disabled",
        "created_at",
        "updated_at"
      ]);
      assert.deepEqual(tableColumns(db, "__intentlang_sessions"), [
        "token_hash",
        "csrf_token_hash",
        "identity_id",
        "role_id",
        "expires_at",
        "created_at",
        "last_seen_at",
        "revoked_at"
      ]);
      assert.deepEqual(tableColumns(db, "__intentlang_audit"), [
        "id",
        "actor_identity_id",
        "actor_role_id",
        "operation",
        "target_entity",
        "target_id",
        "outcome",
        "cause",
        "idempotency_key",
        "before_json",
        "after_json",
        "ir_fingerprint",
        "created_at"
      ]);
      db.close();
    });

    await t.test("existing-account startup ignores bootstrap env", async () => {
      if (!child) {
        throw new Error("Expected running child process");
      }
      await stopServer(child);
      child = undefined;
      const restarted = await startServer(workspace, {
        INTENTLANG_BOOTSTRAP_NAME: "",
        INTENTLANG_BOOTSTRAP_EMAIL: "",
        INTENTLANG_BOOTSTRAP_PASSWORD: ""
      });
      child = restarted.child;
      baseUrl = restarted.baseUrl;
      stderrFn = restarted.stderr;
      adminSession = await login(baseUrl, "admin@example.com", bootstrapAuthInput);
      assert.equal(adminSession.identityEmail, "admin@example.com");
    });

    // ── mutation without CSRF ────────────────────────────────────────────────
    await t.test("mutation without CSRF - returns 403", async () => {
      const res = await fetch(`${baseUrl}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminSession.cookie,
          "Idempotency-Key": randomUUID(),
          Origin: baseUrl
          // NO X-CSRF-Token header
        },
        body: JSON.stringify({ title: "no csrf" })
      });
      assert.equal(res.status, 403);
    });

    // ── wrong Origin ─────────────────────────────────────────────────────────
    await t.test("wrong Origin - returns 403", async () => {
      const res = await fetch(`${baseUrl}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminSession.cookie,
          "Idempotency-Key": randomUUID(),
          "X-CSRF-Token": adminSession.csrf,
          Origin: "https://evil.example.com"
        },
        body: JSON.stringify({ title: "evil" })
      });
      assert.equal(res.status, 403);
    });

    // ── admin provisions Alice ───────────────────────────────────────────────
    await t.test("admin provisions Alice - creates member account", async () => {
      const key = randomUUID();
      const res = await fetch(`${baseUrl}/auth/accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminSession.cookie,
          "X-CSRF-Token": adminSession.csrf,
          "Idempotency-Key": key,
          Origin: baseUrl
        },
        body: JSON.stringify({
          email: "alice@example.com",
          name: "Alice",
          password: aliceAuthInput,
          role_id: "member",
          idempotency_key: key
        })
      });
      assert.equal(res.status, 201, stderrFn());
      const body = (await res.json()) as { data: { id: string; role_id: string } };
      assert.equal(body.data.role_id, "member");
    });

    // ── member login ─────────────────────────────────────────────────────────
    await t.test("member login - Alice can sign in", async () => {
      aliceSession = await login(baseUrl, "alice@example.com", aliceAuthInput);
      assert.equal(aliceSession.roleId, "member");
      assert.ok(Array.isArray(aliceSession.permissions));
    });

    // ── forced ownership ─────────────────────────────────────────────────────
    await t.test("forced ownership - Alice task owner_id set to Alice identity", async () => {
      const res = await fetch(`${baseUrl}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: aliceSession.cookie,
          "X-CSRF-Token": aliceSession.csrf,
          "Idempotency-Key": randomUUID(),
          Origin: baseUrl
        },
        body: JSON.stringify({ title: "Alice's task" })
      });
      assert.equal(res.status, 201, stderrFn());
      aliceTask = (await res.json() as { data: { id: string; version: number } }).data;
      assert.ok(aliceTask.id, "Expected task id");

      // Verify owner_id is Alice's identity
      const adminFetch = await fetch(`${baseUrl}/tasks/${aliceTask.id}`, {
        headers: { Cookie: adminSession.cookie }
      });
      assert.equal(adminFetch.status, 200);
      const row = (await adminFetch.json() as { data: Record<string, unknown> }).data;
      assert.equal(row["owner_id"], aliceSession.identityId, "owner_id must be Alice's identity");
    });

    // ── admin provisions Bob ─────────────────────────────────────────────────
    await t.test("admin provisions Bob - second member account", async () => {
      const key = randomUUID();
      const res = await fetch(`${baseUrl}/auth/accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminSession.cookie,
          "X-CSRF-Token": adminSession.csrf,
          "Idempotency-Key": key,
          Origin: baseUrl
        },
        body: JSON.stringify({
          email: "bob@example.com",
          name: "Bob",
          password: bobAuthInput,
          role_id: "member",
          idempotency_key: key
        })
      });
      assert.equal(res.status, 201, stderrFn());
      bobSession = await login(baseUrl, "bob@example.com", bobAuthInput);
      assert.equal(bobSession.roleId, "member");
    });

    // ── Bob list empty and direct GET 404 ────────────────────────────────────
    await t.test("Bob list empty - Bob cannot see Alice's tasks", async () => {
      const res = await fetch(`${baseUrl}/tasks`, {
        headers: { Cookie: bobSession.cookie }
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: unknown[] };
      assert.equal(body.data.length, 0, "Bob should see 0 tasks (none owned by Bob)");
    });

    await t.test("direct GET 404 - Bob cannot fetch Alice's task", async () => {
      const res = await fetch(`${baseUrl}/tasks/${aliceTask.id}`, {
        headers: { Cookie: bobSession.cookie }
      });
      assert.equal(res.status, 404, "Bob fetching Alice's task should get 404 (hidden)");
    });

    // ── Bob creates his own task ─────────────────────────────────────────────
    await t.test("Bob creates his own task", async () => {
      const res = await fetch(`${baseUrl}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: bobSession.cookie,
          "X-CSRF-Token": bobSession.csrf,
          "Idempotency-Key": randomUUID(),
          Origin: baseUrl
        },
        body: JSON.stringify({ title: "Bob's task" })
      });
      assert.equal(res.status, 201, stderrFn());
      bobTask = (await res.json() as { data: { id: string; version: number } }).data;
    });

    // ── owner update ─────────────────────────────────────────────────────────
    await t.test("owner update - Alice can update her own task", async () => {
      const res = await fetch(`${baseUrl}/tasks/${aliceTask.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: aliceSession.cookie,
          "X-CSRF-Token": aliceSession.csrf,
          Origin: baseUrl
        },
        body: JSON.stringify({ expectedVersion: aliceTask.version, title: "Updated task" })
      });
      assert.equal(res.status, 200, `Update failed: ${stderrFn()}`);
      const updated = (await res.json() as { data: { version: number } }).data;
      aliceTask = { id: aliceTask.id, version: updated.version };
    });

    // ── owner action ─────────────────────────────────────────────────────────
    await t.test("owner action - Alice can run complete on her task", async () => {
      const key = randomUUID();
      const res = await fetch(`${baseUrl}/tasks/${aliceTask.id}/actions/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: aliceSession.cookie,
          "X-CSRF-Token": aliceSession.csrf,
          "Idempotency-Key": key,
          Origin: baseUrl
        },
        body: JSON.stringify({ expectedVersion: aliceTask.version })
      });
      assert.equal(res.status, 200);
      const response = await res.json() as { data: { id: string; version: number; done: number } };
      aliceActionReplay = { key, response };
      const updated = response.data;
      aliceTask = { id: aliceTask.id, version: updated.version };
    });

    // ── action replay 200 ────────────────────────────────────────────────────
    await t.test("action replay - running complete again replays first success", async () => {
      const res = await fetch(`${baseUrl}/tasks/${aliceTask.id}/actions/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: aliceSession.cookie,
          "X-CSRF-Token": aliceSession.csrf,
          "Idempotency-Key": aliceActionReplay.key,
          Origin: baseUrl
        },
        body: JSON.stringify({ expectedVersion: aliceTask.version - 1 })
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("Idempotency-Replayed"), "true");
      const body = (await res.json()) as { data: { id: string; version: number; done: number } };
      assert.deepEqual(body, aliceActionReplay.response);
    });

    // ── spoofed role header ignored ───────────────────────────────────────────
    await t.test("spoofed role ignored - X-Role header has no effect", async () => {
      const key = randomUUID();
      const res = await fetch(`${baseUrl}/auth/accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: aliceSession.cookie,
          "X-CSRF-Token": aliceSession.csrf,
          "Idempotency-Key": key,
          Origin: baseUrl,
          "X-Role": "Administrator" // spoofed
        },
        body: JSON.stringify({
          email: "evil@example.com",
          name: "Evil",
          password: evilAuthInput,
          role_id: "member",
          idempotency_key: key
        })
      });
      assert.equal(res.status, 403, "Member with spoofed role header must be rejected");
    });

    // ── logout revocation ─────────────────────────────────────────────────────
    await t.test("logout revocation - session invalidated after logout", async () => {
      const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
        method: "POST",
        headers: {
          Cookie: aliceSession.cookie,
          "X-CSRF-Token": aliceSession.csrf,
          Origin: baseUrl
        }
      });
      assert.equal(logoutRes.status, 200);
      const meAfterLogout = await fetch(`${baseUrl}/auth/me`, {
        headers: { Cookie: aliceSession.cookie }
      });
      assert.equal(meAfterLogout.status, 401, "Session must be invalid after logout");
    });

    // ── owner immutability - force-owner field not changeable on update ───────
    await t.test("owner immutability - Bob cannot take ownership of Bob task by PUT", async () => {
      const res = await fetch(`${baseUrl}/tasks/${bobTask.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: bobSession.cookie,
          "X-CSRF-Token": bobSession.csrf,
          Origin: baseUrl
        },
        body: JSON.stringify({
          expectedVersion: bobTask.version,
          owner_id: adminSession.identityId // attempt to change ownership
        })
      });
      assert.equal(res.status, 400);
      const body = (await res.json()) as { error: string };
      assert.equal(body.error, "Cannot change owner");
    });

    // ── audit log checks ──────────────────────────────────────────────────────
    await t.test("audit log - no passwords or tokens in audit records", async () => {
      const db = new DatabaseSync(join(workspace, "app.sqlite"));
      const rows = db.prepare('SELECT before_json, after_json FROM "__intentlang_audit"').all() as Array<{
        before_json: string | null;
        after_json: string | null;
      }>;
      assert.ok(rows.length > 0, "Expected at least one audit row");
      for (const row of rows) {
        for (const jsonValue of [row.before_json, row.after_json]) {
          if (jsonValue === null) continue;
          const details = JSON.parse(jsonValue) as Record<string, unknown>;
          assert.ok(!jsonValue.includes("supersecurepass"), "Audit must not contain passwords");
          assert.ok(!jsonValue.includes("alice-secure"), "Audit must not contain passwords");
          assert.ok(!jsonValue.includes("csrf"), "Audit must not contain CSRF values");
          assert.ok(!jsonValue.includes("session"), "Audit must not contain session values");
          assert.ok(!("password" in details), "Audit details must not have password key");
          assert.ok(!("token" in details), "Audit details must not have token key");
          assert.ok(!("csrf_token" in details), "Audit details must not have csrf_token key");
        }
      }
      db.close();
    });

    await t.test("audit log - expected operations, outcomes, and fingerprint logged", async () => {
      const db = new DatabaseSync(join(workspace, "app.sqlite"));
      const rows = db.prepare('SELECT operation, outcome, ir_fingerprint FROM "__intentlang_audit"').all() as Array<{
        operation: string;
        outcome: string;
        ir_fingerprint: string;
      }>;
      const operations = new Set(rows.map((r) => String(r.operation)));
      const outcomes = new Set(rows.map((r) => String(r.outcome)));
      assert.ok(operations.has("auth.login"), "Expected auth.login audit event");
      assert.ok(operations.has("auth.provision"), "Expected auth.provision audit event");
      assert.ok(operations.has("entity.create"), "Expected entity.create audit event");
      assert.ok(outcomes.has("allowed"), "Expected allowed audit outcome");
      assert.ok(outcomes.has("denied"), "Expected denied audit outcome");
      assert.ok(rows.every((row) => row.ir_fingerprint.startsWith("sha256:")));
      db.close();
    });

    // ── idempotency key replay ────────────────────────────────────────────────
    await t.test("idempotency replay - same key returns 200 with Idempotency-Replayed header", async () => {
      const idemKey = randomUUID();
      const first = await fetch(`${baseUrl}/auth/accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminSession.cookie,
          "X-CSRF-Token": adminSession.csrf,
          "Idempotency-Key": idemKey,
          Origin: baseUrl
        },
        body: JSON.stringify({
          email: "carol@example.com",
          name: "Carol",
          password: carolAuthInput,
          role_id: "member",
          idempotency_key: idemKey
        })
      });
      assert.equal(first.status, 201);
      const second = await fetch(`${baseUrl}/auth/accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminSession.cookie,
          "X-CSRF-Token": adminSession.csrf,
          "Idempotency-Key": idemKey,
          Origin: baseUrl
        },
        body: JSON.stringify({
          email: "carol@example.com",
          name: "Carol",
          password: carolAuthInput,
          role_id: "member",
          idempotency_key: idemKey
        })
      });
      assert.equal(second.status, 200, "Replay must return 200");
      const replayed = second.headers.get("Idempotency-Replayed");
      assert.equal(replayed, "true", "Expected Idempotency-Replayed: true header");
    });

    // ── unique conflict ───────────────────────────────────────────────────────
    await t.test("unique conflict - provisioning duplicate email returns 409", async () => {
      const key = randomUUID();
      const res = await fetch(`${baseUrl}/auth/accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminSession.cookie,
          "X-CSRF-Token": adminSession.csrf,
          "Idempotency-Key": key,
          Origin: baseUrl
        },
        body: JSON.stringify({
          email: "alice@example.com", // duplicate
          name: "Alice Duplicate",
          password: aliceAuthInput,
          role_id: "member",
          idempotency_key: key
        })
      });
      assert.equal(res.status, 409);
      const body = (await res.json()) as { code: string };
      assert.equal(body.code, "UNIQUE_CONFLICT");
    });

    // ── security headers ──────────────────────────────────────────────────────
    await t.test("security headers - X-Content-Type-Options and CSP present", async () => {
      const res = await fetch(`${baseUrl}/`);
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
      assert.equal(res.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");
      assert.ok(
        res.headers.get("content-security-policy")?.includes("default-src 'self'; script-src 'self' 'nonce-"),
        "Expected exact CSP baseline"
      );
    });

    // ── favicon 204 ──────────────────────────────────────────────────────────
    await t.test("favicon 204 - GET /favicon.ico returns 204 No Content", async () => {
      const res = await fetch(`${baseUrl}/favicon.ico`);
      assert.equal(res.status, 204, "Expected 204 for /favicon.ico");
    });

    // ── logged-out HTML structure (browser E2E equivalent) ────────────────────
    await t.test("logged-out HTML - theme toggle present, privileged controls start hidden", async () => {
      const res = await fetch(`${baseUrl}/`);
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes('id="theme-toggle"'), "Expected theme-toggle button in served HTML");
      assert.ok(html.includes('aria-label='), "Expected aria-label on theme-toggle");
      assert.ok(
        /id="auth-logout"[^>]*class="[^"]*hidden/.test(html) ||
        /class="[^"]*hidden[^"]*"[^>]*id="auth-logout"/.test(html),
        "Logout button must start hidden in served HTML"
      );
      assert.ok(
        /id="auth-identity-bar"[^>]*class="[^"]*hidden/.test(html) ||
        /class="[^"]*hidden[^"]*"[^>]*id="auth-identity-bar"/.test(html),
        "Identity bar must start hidden in served HTML"
      );
      assert.ok(
        /id="provision-card"[^>]*class="[^"]*hidden/.test(html) ||
        /class="[^"]*hidden[^"]*"[^>]*id="provision-card"/.test(html),
        "Provision card must start hidden in served HTML"
      );
      assert.ok(html.includes('id="auth-login-card"'), "Login card must be present in served HTML");
    });

    // ── unauth endpoint (404 when auth disabled path) ─────────────────────────
    await t.test("action 404 - non-existent entity returns 404", async () => {
      const res = await fetch(`${baseUrl}/nonexistent`);
      assert.equal(res.status, 404);
    });

  } finally {
    if (child) await stopServer(child);
    await rm(workspace, { recursive: true, force: true });
  }
});

