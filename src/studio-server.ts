import { createServer } from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, rename, writeFile, mkdir, unlink, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, basename, dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { createServer as createNetServer, Socket } from "node:net";
import { compileSource, formatSource, canonicalJson } from "./compiler.js";
import { buildManifest } from "./manifest.js";
import { planMigration } from "./planner.js";
import { generateSchema } from "./generator.js";
import { generateRuntime } from "./runtime-codegen.js";
import { generateUi } from "./ui-codegen.js";
import { buildStudioViewModel } from "./studio-viewmodel.js";
import { buildStudioHtml, STUDIO_CSS, STUDIO_JS } from "./studio-assets.js";
import type { BuildManifest } from "./model.js";
import { createAiAssistant } from "./ai-assistant.js";
import type { AiConfig } from "./ai-provider.js";
import { interpretDescription } from "./description-interpreter.js";

const BODY_LIMIT_BYTES = 1_048_576; // 1 MB
const PLAN_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_PORT = 3211;
const PREVIEW_PORT_MIN = 3220;
const PREVIEW_PORT_MAX = 3299;
const PREVIEW_READY_TIMEOUT_MS = 4_000;

// ── Template sources (loaded at startup) ──────────────────────────────────────

const TEMPLATE_TODO = `application Todo
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

const TEMPLATE_ISSUE_TRACKER = `application IssueTracker
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

// ── Plan token store ──────────────────────────────────────────────────────────

interface PlanTokenEntry {
  sourceFingerprint: string;
  expiresAt: number;
}

const planTokenStore = new Map<string, PlanTokenEntry>();

function createPlanToken(sourceFingerprint: string): string {
  const token = randomBytes(24).toString("hex");
  planTokenStore.set(token, {
    sourceFingerprint,
    expiresAt: Date.now() + PLAN_TOKEN_TTL_MS
  });
  return token;
}

function consumePlanToken(token: string, sourceFingerprint: string): boolean {
  const entry = planTokenStore.get(token);
  planTokenStore.delete(token);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) return false;
  return entry.sourceFingerprint === sourceFingerprint;
}

function sourceFingerprint(source: string): string {
  return "sha256:" + createHash("sha256").update(source, "utf8").digest("hex");
}

// ── Security helpers ──────────────────────────────────────────────────────────

function securityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'"
  };
}

function sendJson(
  res: import("node:http").ServerResponse,
  status: number,
  data: unknown
): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...securityHeaders()
  });
  res.end(body);
}

function sendHtml(
  res: import("node:http").ServerResponse,
  body: string
): void {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...securityHeaders()
  });
  res.end(body);
}

function sendText(
  res: import("node:http").ServerResponse,
  contentType: string,
  body: string
): void {
  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
    ...securityHeaders()
  });
  res.end(body);
}

// ── Same-origin validation ────────────────────────────────────────────────────

function validateSameOrigin(
  req: import("node:http").IncomingMessage,
  host: string
): string | null {
  const origin = req.headers["origin"];
  const reqHost = req.headers["host"];

  if (typeof reqHost !== "string") {
    return "Missing Host header.";
  }

  if (reqHost !== host) {
    return `Host mismatch: expected ${host}, got ${reqHost}.`;
  }

  if (typeof origin === "string") {
    const expectedOrigin = `http://${host}`;
    if (origin !== expectedOrigin) {
      return `Origin denied: ${origin}.`;
    }
  }

  return null;
}

// ── CSRF validation ───────────────────────────────────────────────────────────

function validateCsrf(
  req: import("node:http").IncomingMessage,
  csrfToken: string
): string | null {
  const header = req.headers["x-studio-csrf-token"];
  if (typeof header !== "string" || header.length === 0) {
    return "Missing X-Studio-CSRF-Token header.";
  }
  try {
    const expected = Buffer.from(csrfToken, "utf8");
    const received = Buffer.from(header, "utf8");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      return "Invalid CSRF token.";
    }
  } catch {
    return "CSRF validation error.";
  }
  return null;
}

// ── Body reader ───────────────────────────────────────────────────────────────

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve2, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let aborted = false;

    req.on("data", (chunk: Buffer) => {
      if (aborted) return;
      totalBytes += chunk.length;
      if (totalBytes > BODY_LIMIT_BYTES) {
        aborted = true;
        reject(new BodyTooLargeError());
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (aborted) return;
      resolve2(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", reject);
  });
}

class BodyTooLargeError extends Error {
  constructor() {
    super("Request body exceeds 1 MB limit.");
    this.name = "BodyTooLargeError";
  }
}

// ── Compile helper ────────────────────────────────────────────────────────────

function compileAndBuildState(source: string): {
  ok: boolean;
  diagnostics: unknown[];
  model: unknown;
  canonical: string;
  ir: unknown;
} {
  const result = compileSource(source);

  if (!result.ok) {
    return {
      ok: false,
      diagnostics: result.diagnostics,
      model: null,
      canonical: "",
      ir: null
    };
  }

  const model = buildStudioViewModel(result.ir);
  const canonical = formatSource(result.ir);

  return {
    ok: true,
    diagnostics: [],
    model,
    canonical,
    ir: result.ir
  };
}

// ── Atomic write ──────────────────────────────────────────────────────────────

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const dir = dirname(filePath);
  const tmpPath = join(dir, `.intentlang-studio-${randomBytes(8).toString("hex")}.tmp`);
  await writeFile(tmpPath, content, "utf8");
  await rename(tmpPath, filePath);
}

// ── Wizard build transaction helpers ──────────────────────────────────────────

interface GeneratedArtifacts {
  "app.mjs": string;
  "migration.sql": string;
  "intentlang.manifest.json": string;
  "package.json": string;
  "index.html": string;
  "app.js": string;
  "styles.css": string;
}

async function writeGeneratedArtifacts(
  directory: string,
  artifacts: GeneratedArtifacts
): Promise<void> {
  await mkdir(directory, { recursive: true });
  for (const [name, content] of Object.entries(artifacts)) {
    await writeFile(join(directory, name), content, "utf8");
  }
}

async function restoreExistingOutputDir(
  outputDir: string,
  backupDir: string | null
): Promise<void> {
  try {
    if (existsSync(outputDir)) {
      await rm(outputDir, { recursive: true, force: true });
    }
  } catch {
    // Best effort only
  }
  if (backupDir !== null && existsSync(backupDir)) {
    await rename(backupDir, outputDir);
  }
}

async function restoreSourceFile(
  sourcePath: string,
  sourceBackupPath: string | null,
  hadExistingSource: boolean
): Promise<void> {
  try {
    if (existsSync(sourcePath)) {
      await unlink(sourcePath);
    }
  } catch {
    // Best effort only
  }

  if (sourceBackupPath !== null && existsSync(sourceBackupPath)) {
    await rename(sourceBackupPath, sourcePath);
  } else if (!hadExistingSource) {
    try {
      await unlink(sourcePath);
    } catch {
      // Best effort only
    }
  }
}

async function commitWizardBuildTransaction(options: {
  sourcePath: string;
  sourceContent: string;
  outputDir: string;
  artifacts: GeneratedArtifacts;
}): Promise<void> {
  const parentDir = dirname(options.outputDir);
  const tempDir = join(parentDir, `.intentlang-wizard-next-${randomBytes(8).toString("hex")}`);
  const backupDir = join(parentDir, `.intentlang-wizard-backup-${randomBytes(8).toString("hex")}`);
  const sourceTempPath = join(dirname(options.sourcePath), `.intentlang-source-next-${randomBytes(8).toString("hex")}.tmp`);
  const sourceBackupPath = join(dirname(options.sourcePath), `.intentlang-source-backup-${randomBytes(8).toString("hex")}.bak`);
  const preservedSqliteBackupPath = join(backupDir, "app.sqlite");
  const preservedSqliteTargetPath = join(options.outputDir, "app.sqlite");
  const hadExistingOutput = existsSync(options.outputDir);
  const hadExistingSource = existsSync(options.sourcePath);
  let outputBackedUp = false;
  let sourceBackedUp = false;
  let outputSwapped = false;
  let sourceCommitted = false;

  try {
    await writeGeneratedArtifacts(tempDir, options.artifacts);
    await writeFile(sourceTempPath, options.sourceContent, "utf8");

    if (hadExistingOutput) {
      await rename(options.outputDir, backupDir);
      outputBackedUp = true;
    }

    await rename(tempDir, options.outputDir);
    outputSwapped = true;

    if (hadExistingSource) {
      await rename(options.sourcePath, sourceBackupPath);
      sourceBackedUp = true;
    }

    await rename(sourceTempPath, options.sourcePath);
    sourceCommitted = true;

    if (!existsSync(preservedSqliteTargetPath) && existsSync(preservedSqliteBackupPath)) {
      await rename(preservedSqliteBackupPath, preservedSqliteTargetPath);
    }
  } catch (err) {
    if (sourceCommitted || sourceBackedUp) {
      await restoreSourceFile(options.sourcePath, sourceBackedUp ? sourceBackupPath : null, hadExistingSource);
    } else {
      try {
        await unlink(sourceTempPath);
      } catch {
        // Best effort only
      }
    }

    if (outputSwapped || outputBackedUp) {
      await restoreExistingOutputDir(options.outputDir, outputBackedUp ? backupDir : null);
    } else {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // Best effort only
      }
    }

    throw err;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    await rm(backupDir, { recursive: true, force: true }).catch(() => undefined);
    if (!sourceCommitted) {
      await rm(sourceTempPath, { force: true }).catch(() => undefined);
    }
    if (!sourceBackedUp) {
      await rm(sourceBackupPath, { force: true }).catch(() => undefined);
    }
    if (sourceCommitted && sourceBackedUp) {
      await rm(sourceBackupPath, { force: true }).catch(() => undefined);
    }
  }
}

// ── Preview helpers ────────────────────────────────────────────────────────────

function previewUrlForPort(port: number): string {
  return `http://127.0.0.1:${port}`;
}

async function findAvailablePreviewPort(): Promise<number | null> {
  for (let port = PREVIEW_PORT_MIN; port <= PREVIEW_PORT_MAX; port += 1) {
    const available = await new Promise<boolean>((resolvePort) => {
      const probe = createNetServer();
      probe.once("error", () => resolvePort(false));
      probe.listen(port, "127.0.0.1", () => {
        probe.close(() => resolvePort(true));
      });
    });
    if (available) {
      return port;
    }
  }
  return null;
}

async function waitForPreviewReady(port: number, child: import("node:child_process").ChildProcess): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < PREVIEW_READY_TIMEOUT_MS) {
    if (child.exitCode !== null || child.killed) {
      return false;
    }

    const ready = await new Promise<boolean>((resolveReady) => {
      const socket = new Socket();
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolveReady(value);
      };

      socket.setTimeout(250);
      socket.once("connect", () => finish(true));
      socket.once("timeout", () => finish(false));
      socket.once("error", () => finish(false));
      socket.connect(port, "127.0.0.1");
    });

    if (ready) {
      return true;
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }

  return false;
}

function authEnabledFromManifest(manifest: BuildManifest | null): boolean | null {
  if (!manifest || typeof manifest !== "object") {
    return null;
  }
  return manifest.ir?.authentication !== undefined;
}

// ── Open browser (platform-safe) ──────────────────────────────────────────────

function openBrowser(url: string): void {
  const platform = process.platform;
  let cmd: string;
  let args: string[];

  if (platform === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", url];
  } else if (platform === "darwin") {
    cmd = "open";
    args = [url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }

  try {
    const child = spawn(cmd, args, {
      detached: true,
      stdio: "ignore",
      shell: false
    });
    child.unref();
  } catch {
    // Non-fatal; URL was already printed
  }
}

// ── Server factory ────────────────────────────────────────────────────────────

export interface StudioOptions {
  sourcePath: string;
  port?: number;
  noOpen?: boolean;
  ai?: AiConfig;
}

export async function startStudio(options: StudioOptions): Promise<{
  close: () => Promise<void>;
  port: number;
  url: string;
}> {
  const sourcePath = resolve(options.sourcePath);
  const cwd = process.cwd();

  // Validate source path is within cwd
  if (!sourcePath.startsWith(cwd + "\\") && !sourcePath.startsWith(cwd + "/") && sourcePath !== cwd) {
    // Check using resolved path comparison
    const relative = sourcePath.replace(cwd, "");
    if (relative.startsWith("\\..") || relative.startsWith("/..")) {
      throw new Error(`Source path must be within current working directory.`);
    }
  }

  const filename = basename(sourcePath);
  const base = basename(sourcePath, ".intent");
  const outputDir = join(dirname(sourcePath), `${base}-app`);

  const port = options.port ?? DEFAULT_PORT;
  const host = `127.0.0.1:${port}`;
  const url = `http://${host}`;

  // Preview process management (loopback only, lifecycle-bound to studio server)
  let previewProc: import("node:child_process").ChildProcess | null = null;
  let previewPort: number | null = null;

  function previewStatusBody(): { running: boolean; port?: number; url?: string } {
    if (previewProc !== null && previewPort !== null) {
      return {
        running: true,
        port: previewPort,
        url: previewUrlForPort(previewPort)
      };
    }
    return { running: false };
  }

  async function stopPreviewProcess(): Promise<void> {
    const current = previewProc;
    previewProc = null;
    previewPort = null;
    if (current !== null) {
      try {
        current.kill();
      } catch {
        // Non-fatal
      }
    }
  }

  // Ephemeral CSRF token — never written to disk or logs
  const csrfToken = randomBytes(32).toString("hex");

  // Pre-render the HTML once (with correct port)
  const studioHtml = buildStudioHtml(filename, port);

  // Initialize AI assistant at startup; configuration is process memory only
  const { assistant: aiAssistant, configError: aiConfigError } =
    await createAiAssistant(options.ai ?? { provider: "none", model: "", endpoint: "", timeoutMs: 60_000, allowRemote: false });

  if (aiConfigError) {
    console.warn(`[Studio] AI configuration warning: ${aiConfigError}`);
  }

  if (aiAssistant.info.provider !== "none") {
    console.log(
      `[Studio] AI assistance: ${aiAssistant.info.provider} / ${aiAssistant.info.model || "(default model)"} at ${aiAssistant.info.endpointOrigin}`
    );
    console.log(`[Studio] AI is optional — compiler and Studio guided mode remain AI-free.`);
  }

  const server = createServer(async (req, res) => {
    const method = req.method ?? "GET";
    const rawUrl = req.url ?? "/";
    const pathname = rawUrl.split("?")[0];

    // ── Route allowlist ─────────────────────────────────────────────────────

    const allowedRoutes: [string, string][] = [
      ["GET", "/"],
      ["GET", "/studio.js"],
      ["GET", "/studio.css"],
      ["GET", "/api/state"],
      ["GET", "/api/preview/status"],
      ["POST", "/api/check"],
      ["POST", "/api/format"],
      ["POST", "/api/save"],
      ["POST", "/api/plan"],
      ["POST", "/api/generate"],
      ["POST", "/api/ai/propose"],
      ["POST", "/api/interpret"],
      ["POST", "/api/wizard/interpret"],
      ["POST", "/api/wizard/build"],
      ["POST", "/api/preview/start"],
      ["POST", "/api/preview/stop"]
    ];

    const routeAllowed = allowedRoutes.some(
      ([m, p]) => m === method && p === pathname
    );

    if (!routeAllowed) {
      sendJson(res, 404, { code: "NOT_FOUND", error: "Not found." });
      return;
    }

    // ── Static assets ───────────────────────────────────────────────────────

    if (method === "GET" && pathname === "/") {
      sendHtml(res, studioHtml);
      return;
    }

    if (method === "GET" && pathname === "/studio.js") {
      sendText(res, "text/javascript; charset=utf-8", STUDIO_JS);
      return;
    }

    if (method === "GET" && pathname === "/studio.css") {
      sendText(res, "text/css; charset=utf-8", STUDIO_CSS);
      return;
    }

    // ── GET /api/state ──────────────────────────────────────────────────────

    if (method === "GET" && pathname === "/api/state") {
      let source = "";
      try {
        source = await readFile(sourcePath, "utf8");
      } catch {
        // File may not exist yet; return empty
      }

      const compiled = compileAndBuildState(source);

      sendJson(res, 200, {
        filename,
        source,
        csrfToken, // ephemeral, in-memory only
        diagnostics: compiled.diagnostics,
        model: compiled.model,
        canonical: compiled.canonical,
        ir: compiled.ir,
        outputDir,
        templates: {
          todo: TEMPLATE_TODO,
          "issue-tracker": TEMPLATE_ISSUE_TRACKER
        },
        // AI info: provider/model/origin only — never the API key
        ai: {
          provider: aiAssistant.info.provider,
          model: aiAssistant.info.model,
          endpointOrigin: aiAssistant.info.endpointOrigin,
          isLocal: aiAssistant.info.isLocal,
          configError: aiConfigError ?? null
        }
      });
      return;
    }

    // ── GET /api/preview/status ─────────────────────────────────────────────

    if (method === "GET" && pathname === "/api/preview/status") {
      sendJson(res, 200, previewStatusBody());
      return;
    }

    // ── POST endpoints: same-origin + CSRF validation ───────────────────────

    const originError = validateSameOrigin(req, host);
    if (originError) {
      sendJson(res, 403, { code: "FORBIDDEN", error: originError });
      return;
    }

    const csrfError = validateCsrf(req, csrfToken);
    if (csrfError) {
      sendJson(res, 403, { code: "FORBIDDEN", error: csrfError });
      return;
    }

    // ── Read body ───────────────────────────────────────────────────────────

    let rawBody: string;
    try {
      rawBody = await readBody(req);
    } catch (err) {
      if (err instanceof BodyTooLargeError) {
        sendJson(res, 413, { code: "PAYLOAD_TOO_LARGE", error: err.message });
      } else {
        sendJson(res, 400, { code: "BAD_REQUEST", error: "Could not read request body." });
      }
      return;
    }

    let body: Record<string, unknown>;
    try {
      body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    } catch {
      sendJson(res, 400, { code: "BAD_REQUEST", error: "Request body must be valid JSON." });
      return;
    }

    // ── POST /api/check ─────────────────────────────────────────────────────

    if (pathname === "/api/check") {
      const source = typeof body["source"] === "string" ? body["source"] : "";
      const compiled = compileAndBuildState(source);
      sendJson(res, 200, compiled);
      return;
    }

    // ── POST /api/format ────────────────────────────────────────────────────

    if (pathname === "/api/format") {
      const source = typeof body["source"] === "string" ? body["source"] : "";
      const result = compileSource(source);

      if (!result.ok) {
        sendJson(res, 422, {
          code: "COMPILE_ERROR",
          error: "Source has errors. Fix them before formatting.",
          diagnostics: result.diagnostics
        });
        return;
      }

      const formatted = formatSource(result.ir);
      sendJson(res, 200, { formatted });
      return;
    }

    // ── POST /api/save ──────────────────────────────────────────────────────

    if (pathname === "/api/save") {
      const source = typeof body["source"] === "string" ? body["source"] : "";

      try {
        await atomicWrite(sourcePath, source);
      } catch (err) {
        sendJson(res, 500, {
          code: "WRITE_ERROR",
          error: `Could not save file: ${String(err)}`
        });
        return;
      }

      sendJson(res, 200, { saved: true, path: filename });
      return;
    }

    // ── POST /api/plan ──────────────────────────────────────────────────────

    if (pathname === "/api/plan") {
      const source = typeof body["source"] === "string" ? body["source"] : "";
      const result = compileSource(source);

      if (!result.ok) {
        sendJson(res, 422, {
          code: "COMPILE_ERROR",
          error: "Source has errors. Fix them before generating.",
          diagnostics: result.diagnostics
        });
        return;
      }

      const manifest = buildManifest(result.ir);
      const manifestPath = join(outputDir, "intentlang.manifest.json");

      let previousManifest: BuildManifest | undefined;
      if (existsSync(manifestPath)) {
        try {
          const raw = await readFile(manifestPath, "utf8");
          previousManifest = JSON.parse(raw) as BuildManifest;
        } catch {
          // Ignore unreadable manifest
        }
      }

      let planItems: unknown[] = [];
      let isDestructive = false;
      let isSecurityDestructive = false;

      if (previousManifest && previousManifest.irFingerprint !== manifest.irFingerprint) {
        const plan = planMigration(previousManifest, result.ir);
        planItems = plan.items;
        isDestructive = plan.isDestructive;
        isSecurityDestructive = plan.isSecurityDestructive;
      }

      const fp = sourceFingerprint(source);
      const planToken = createPlanToken(fp);

      const artifacts = [
        "app.mjs",
        "migration.sql",
        "intentlang.manifest.json",
        "package.json",
        "index.html",
        "app.js",
        "styles.css"
      ];

      sendJson(res, 200, {
        plan: planItems,
        isDestructive,
        isSecurityDestructive,
        outputDir,
        artifacts,
        planToken, // ephemeral, in-memory, short-lived
        authEnabled: result.ir.authentication !== undefined
      });
      return;
    }

    // ── POST /api/generate ──────────────────────────────────────────────────

    if (pathname === "/api/generate") {
      const source = typeof body["source"] === "string" ? body["source"] : "";
      const planToken = typeof body["planToken"] === "string" ? body["planToken"] : "";

      // Validate plan token (anti-TOCTOU)
      const fp = sourceFingerprint(source);
      if (!consumePlanToken(planToken, fp)) {
        sendJson(res, 409, {
          code: "PLAN_TOKEN_INVALID",
          error:
            "Plan token is invalid, expired, or the source has changed since the plan was created. " +
            "Open the Generate App dialog again to get a fresh plan."
        });
        return;
      }

      const result = compileSource(source);
      if (!result.ok) {
        sendJson(res, 422, {
          code: "COMPILE_ERROR",
          error: "Source has errors.",
          diagnostics: result.diagnostics
        });
        return;
      }

      // Safety checks — refuse destructive/security-downgrade from browser
      const manifest = buildManifest(result.ir);
      const manifestPath = join(outputDir, "intentlang.manifest.json");

      let previousManifest: BuildManifest | undefined;
      if (existsSync(manifestPath)) {
        try {
          const raw = await readFile(manifestPath, "utf8");
          previousManifest = JSON.parse(raw) as BuildManifest;
        } catch {
          // Ignore
        }
      }

      if (previousManifest && previousManifest.irFingerprint !== manifest.irFingerprint) {
        const plan = planMigration(previousManifest, result.ir);
        if (plan.isDestructive) {
          sendJson(res, 409, {
            code: "DESTRUCTIVE_CHANGES",
            error:
              "Destructive schema changes detected. Studio does not support unsafe data migrations. " +
              "Use the CLI: intentlang generate <source> --output <dir> --write --force --allow-data-loss"
          });
          return;
        }
        if (plan.isSecurityDestructive) {
          sendJson(res, 409, {
            code: "SECURITY_DOWNGRADE",
            error:
              "Security-destructive changes detected (authentication removed or changed). " +
              "Use the CLI: intentlang generate <source> --output <dir> --write --force --allow-security-downgrade"
          });
          return;
        }
      }

      // Generate artifacts
      try {
        if (!existsSync(outputDir)) {
          await mkdir(outputDir, { recursive: true });
        }
      } catch (err) {
        sendJson(res, 500, { code: "MKDIR_ERROR", error: `Could not create output directory: ${String(err)}` });
        return;
      }

      const schema = generateSchema(result.ir);
      const ui = generateUi(result.ir);
      const runtime = generateRuntime(result.ir, manifest, ui);

      const files: [string, string][] = [
        [join(outputDir, "app.mjs"), runtime.appMjs],
        [join(outputDir, "migration.sql"), schema.migrationSql],
        [join(outputDir, "intentlang.manifest.json"), canonicalJson(manifest) + "\n"],
        [join(outputDir, "package.json"), runtime.packageJson],
        [join(outputDir, "index.html"), ui.indexHtml],
        [join(outputDir, "app.js"), ui.appJs],
        [join(outputDir, "styles.css"), ui.stylesCss]
      ];

      try {
        for (const [filePath, content] of files) {
          await writeFile(filePath, content, "utf8");
        }
      } catch (err) {
        sendJson(res, 500, { code: "WRITE_ERROR", error: `Could not write artifacts: ${String(err)}` });
        return;
      }

      const artifacts = files.map(([p]) => basename(p));
      artifacts.push("(app.sqlite preserved if it exists)");

      sendJson(res, 200, {
        outputDir,
        artifacts,
        authEnabled: result.ir.authentication !== undefined
      });
      return;
    }

    // ── POST /api/interpret ─────────────────────────────────────────────────

    if (pathname === "/api/interpret") {
      const description =
        typeof body["description"] === "string" ? body["description"].trim() : "";
      const rawUsersAnswer =
        typeof body["usersAnswer"] === "string" ? body["usersAnswer"] : undefined;

      if (!description) {
        sendJson(res, 400, {
          code: "INTERPRET_EMPTY",
          error: "description is required and must be a non-empty string."
        });
        return;
      }

      const usersAnswer =
        rawUsersAnswer === "person" || rawUsersAnswer === "auth-user"
          ? rawUsersAnswer
          : undefined;

      const result = interpretDescription(description, usersAnswer ? { usersAnswer } : undefined);

      if (result.kind === "unrecognized") {
        sendJson(res, 200, { kind: "unrecognized", reason: result.reason });
        return;
      }

      if (result.kind === "clarification") {
        sendJson(res, 200, {
          kind: "clarification",
          questions: result.questions,
          partialAssumptions: result.partialAssumptions
        });
        return;
      }

      // Compile proposed source to validate — invalid output is a bug
      const compiled = compileSource(result.source);
      if (!compiled.ok) {
        sendJson(res, 500, {
          code: "INTERPRET_BUG",
          error:
            "Description interpreter produced source that does not compile. Please report this as a bug.",
          diagnostics: compiled.diagnostics,
          proposedSource: result.source
        });
        return;
      }

      // Build diff lines (proposed source vs empty)
      const proposedLines = result.source.split("\n");
      const diff = proposedLines.map((line) => ({ op: "add", line }));

      sendJson(res, 200, {
        kind: "proposal",
        appName: result.appName,
        entityName: result.entityName,
        source: result.source,
        assumptions: result.assumptions,
        warnings: result.warnings,
        unsupportedCapabilities: result.unsupportedCapabilities,
        supportedFieldCount: result.supportedFieldCount,
        diff
      });
      return;
    }

    // ── POST /api/ai/propose ────────────────────────────────────────────────

    if (pathname === "/api/ai/propose") {
      // Accept only description, currentSource, and clarificationAnswers from browser.
      // Provider, endpoint, and API key are resolved at startup — never from browser.
      const description = typeof body["description"] === "string" ? body["description"].trim() : "";
      const currentSource = typeof body["currentSource"] === "string" ? body["currentSource"] : "";
      const rawAnswers = Array.isArray(body["clarificationAnswers"]) ? body["clarificationAnswers"] : [];

      if (!description) {
        sendJson(res, 400, {
          code: "AI_CONFIG_INVALID",
          error: "description is required and must be a non-empty string."
        });
        return;
      }

      // Validate clarificationAnswers shape
      const clarificationAnswers: Array<{ questionId: string; selectedOption: string }> = [];
      for (const ans of rawAnswers) {
        if (
          ans !== null &&
          typeof ans === "object" &&
          typeof ans["questionId"] === "string" &&
          typeof ans["selectedOption"] === "string"
        ) {
          clarificationAnswers.push({
            questionId: String(ans["questionId"]).slice(0, 64),
            selectedOption: String(ans["selectedOption"]).slice(0, 512)
          });
        }
      }

      // Build current diagnostics and model summary from current source
      const compiled = compileAndBuildState(currentSource);
      const currentDiagnostics = (compiled.diagnostics as Array<{
        line: number; column: number; code: string; message: string; hint: string;
      }>).map((d) => ({ line: d.line, column: d.column, code: d.code, message: d.message }));

      let modelSummary = "";
      if (compiled.ok && compiled.model) {
        const m = compiled.model as {
          applicationName?: string;
          entities?: Array<{ name: string }>;
          roles?: Array<{ name: string }>;
        };
        const parts: string[] = [];
        if (m.applicationName) parts.push(`Application: ${m.applicationName}`);
        if (m.entities?.length) parts.push(`Entities: ${m.entities.map((e) => e.name).join(", ")}`);
        if (m.roles?.length) parts.push(`Roles: ${m.roles.map((r) => r.name).join(", ")}`);
        modelSummary = parts.join("; ");
      }

      // Call AI assistant — no description/source/response written to logs
      const result = await aiAssistant.propose({
        description,
        currentSource,
        currentDiagnostics,
        currentModelSummary: modelSummary,
        clarificationAnswers: clarificationAnswers.length > 0 ? clarificationAnswers : undefined
      });

      if (result.kind === "error") {
        const status = result.code === "AI_DISABLED" ? 200 :
                       result.code === "AI_RATE_LIMITED" ? 429 :
                       result.code === "AI_TIMEOUT" ? 504 :
                       result.code === "AI_PROVIDER_UNAVAILABLE" ? 502 : 422;

        sendJson(res, status, {
          code: result.code,
          error: result.error,
          diagnostics: result.diagnostics ?? []
        });
        return;
      }

      // Return sanitized result — never includes API key or raw upstream errors
      sendJson(res, 200, result);
      return;
    }

    // ── POST /api/wizard/interpret ──────────────────────────────────────────

    if (pathname === "/api/wizard/interpret") {
      const description =
        typeof body["description"] === "string" ? body["description"].trim() : "";
      const rawUsersAnswer =
        typeof body["usersAnswer"] === "string" ? body["usersAnswer"] : undefined;

      if (!description) {
        sendJson(res, 400, {
          code: "INTERPRET_EMPTY",
          error: "description is required and must be a non-empty string."
        });
        return;
      }

      const usersAnswer =
        rawUsersAnswer === "person" || rawUsersAnswer === "auth-user"
          ? rawUsersAnswer
          : undefined;

      const wizResult = interpretDescription(
        description,
        usersAnswer ? { usersAnswer } : undefined
      );

      if (wizResult.kind === "unrecognized") {
        sendJson(res, 200, { kind: "unrecognized", reason: wizResult.reason });
        return;
      }

      if (wizResult.kind === "clarification") {
        sendJson(res, 200, {
          kind: "clarification",
          questions: wizResult.questions,
          partialAssumptions: wizResult.partialAssumptions
        });
        return;
      }

      // Validate interpreted source
      const wizCompiled = compileSource(wizResult.source);
      if (!wizCompiled.ok) {
        sendJson(res, 500, {
          code: "INTERPRET_BUG",
          error: "Description interpreter produced source that does not compile. Please report this as a bug.",
          diagnostics: wizCompiled.diagnostics,
          proposedSource: wizResult.source
        });
        return;
      }

      // Issue a wizard build token tied to the proposed source fingerprint
      const wizFp = sourceFingerprint(wizResult.source);
      const proposalToken = createPlanToken(wizFp);

      const proposedLines = wizResult.source.split("\n");
      const diff = proposedLines.map((line) => ({ op: "add", line }));

      sendJson(res, 200, {
        kind: "proposal",
        appName: wizResult.appName,
        entityName: wizResult.entityName,
        source: wizResult.source,
        assumptions: wizResult.assumptions,
        warnings: wizResult.warnings,
        unsupportedCapabilities: wizResult.unsupportedCapabilities,
        supportedFieldCount: wizResult.supportedFieldCount,
        diff,
        proposalToken
      });
      return;
    }

    // ── POST /api/wizard/build ──────────────────────────────────────────────

    if (pathname === "/api/wizard/build") {
      const proposedSource =
        typeof body["proposedSource"] === "string" ? body["proposedSource"] : "";
      const proposalToken =
        typeof body["proposalToken"] === "string" ? body["proposalToken"] : "";

      if (!proposedSource) {
        sendJson(res, 400, {
          code: "BAD_REQUEST",
          error: "proposedSource is required and must be a non-empty string."
        });
        return;
      }

      // Validate wizard build token (anti-TOCTOU, consumes on first use)
      const wizBuildFp = sourceFingerprint(proposedSource);
      if (!consumePlanToken(proposalToken, wizBuildFp)) {
        sendJson(res, 409, {
          code: "PLAN_TOKEN_INVALID",
          error:
            "Proposal token is invalid, expired, or the proposed source has changed since interpretation. " +
            "Return to Step 1 and interpret your description again."
        });
        return;
      }

      const buildResult = compileSource(proposedSource);
      if (!buildResult.ok) {
        sendJson(res, 422, {
          code: "COMPILE_ERROR",
          error: "Source has errors.",
          diagnostics: buildResult.diagnostics
        });
        return;
      }

      // Refuse destructive/security-downgrade migrations
      const buildManifestObj = buildManifest(buildResult.ir);
      const buildManifestPath = join(outputDir, "intentlang.manifest.json");
      let buildPrevManifest: BuildManifest | undefined;
      if (existsSync(buildManifestPath)) {
        try {
          const raw = await readFile(buildManifestPath, "utf8");
          buildPrevManifest = JSON.parse(raw) as BuildManifest;
        } catch { /* ignore */ }
      }
      if (buildPrevManifest && buildPrevManifest.irFingerprint !== buildManifestObj.irFingerprint) {
        const migPlan = planMigration(buildPrevManifest, buildResult.ir);
        if (migPlan.isDestructive) {
          sendJson(res, 409, {
            code: "DESTRUCTIVE_CHANGES",
            error:
              "Destructive schema changes detected. Wizard cannot perform unsafe migrations. " +
              "Use the CLI: intentlang generate <source> --output <dir> --write --force --allow-data-loss"
          });
          return;
        }
        if (migPlan.isSecurityDestructive) {
          sendJson(res, 409, {
            code: "SECURITY_DOWNGRADE",
            error:
              "Security-destructive changes detected. " +
              "Use the CLI: intentlang generate <source> --output <dir> --write --force --allow-security-downgrade"
          });
          return;
        }
      }

      const buildSchema = generateSchema(buildResult.ir);
      const buildUi = generateUi(buildResult.ir);
      const buildRuntime = generateRuntime(buildResult.ir, buildManifestObj, buildUi);

      try {
        await stopPreviewProcess();
        await commitWizardBuildTransaction({
          sourcePath,
          sourceContent: proposedSource,
          outputDir,
          artifacts: {
            "app.mjs": buildRuntime.appMjs,
            "migration.sql": buildSchema.migrationSql,
            "intentlang.manifest.json": canonicalJson(buildManifestObj) + "\n",
            "package.json": buildRuntime.packageJson,
            "index.html": buildUi.indexHtml,
            "app.js": buildUi.appJs,
            "styles.css": buildUi.stylesCss
          }
        });
      } catch (err) {
        sendJson(res, 500, {
          code: "WRITE_ERROR",
          error: `Could not write artifacts: ${String(err)}`
        });
        return;
      }

      const artifacts = [
        "app.mjs",
        "migration.sql",
        "intentlang.manifest.json",
        "package.json",
        "index.html",
        "app.js",
        "styles.css"
      ];
      artifacts.push("(app.sqlite preserved if it exists)");

      sendJson(res, 200, {
        ok: true,
        outputDir,
        artifacts,
        authEnabled: buildResult.ir.authentication !== undefined
      });
      return;
    }

    // ── POST /api/preview/start ─────────────────────────────────────────────

    if (pathname === "/api/preview/start") {
      const appMjsPath = join(outputDir, "app.mjs");
      if (!existsSync(appMjsPath)) {
        sendJson(res, 200, {
          ok: false,
          reason: "No generated app found. Build the app first using the wizard."
        });
        return;
      }

      if (previewProc !== null && previewPort !== null) {
        sendJson(res, 200, {
          ok: true,
          port: previewPort,
          url: previewUrlForPort(previewPort)
        });
        return;
      }

      let manifest: BuildManifest | null = null;
      try {
        manifest = JSON.parse(await readFile(join(outputDir, "intentlang.manifest.json"), "utf8")) as BuildManifest;
      } catch {
        manifest = null;
      }

      const authEnabled = authEnabledFromManifest(manifest);
      if (authEnabled === null) {
        sendJson(res, 200, {
          ok: false,
          reason: "Could not verify whether the generated app requires authentication."
        });
        return;
      }

      if (authEnabled) {
        sendJson(res, 200, {
          ok: false,
          reason: "Authenticated apps cannot be previewed from the wizard. Use the bootstrap guidance and run the generated app manually."
        });
        return;
      }

      const pPort = await findAvailablePreviewPort();
      if (pPort === null) {
        sendJson(res, 200, {
          ok: false,
          reason: `No preview port was available in the ${PREVIEW_PORT_MIN}-${PREVIEW_PORT_MAX} range.`
        });
        return;
      }

      const child = spawn(process.execPath, [appMjsPath], {
        cwd: outputDir,
        env: { ...process.env, HOST: "127.0.0.1", PORT: String(pPort) },
        stdio: "ignore",
        shell: false,
        detached: false
      });
      previewProc = child;
      previewPort = pPort;

      child.on("exit", () => {
        if (previewProc === child) { previewProc = null; previewPort = null; }
      });
      child.on("error", () => {
        if (previewProc === child) { previewProc = null; previewPort = null; }
      });

      const ready = await waitForPreviewReady(pPort, child);
      if (!ready) {
        await stopPreviewProcess();
        sendJson(res, 200, {
          ok: false,
          reason: "Preview server failed to start."
        });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        port: pPort,
        url: previewUrlForPort(pPort)
      });
      return;
    }

    // ── POST /api/preview/stop ──────────────────────────────────────────────

    if (pathname === "/api/preview/stop") {
      await stopPreviewProcess();
      sendJson(res, 200, { ok: true });
      return;
    }

    // Should not reach here
    sendJson(res, 404, { code: "NOT_FOUND", error: "Not found." });
  });

  await new Promise<void>((resolveP, rejectP) => {
    server.on("error", rejectP);
    server.listen(port, "127.0.0.1", () => resolveP());
  });

  console.log(`IntentLang Studio`);
  console.log(`  Source file: ${sourcePath}`);
  console.log(`  Output dir:  ${outputDir}`);
  console.log(`  URL:         ${url}`);
  console.log(`  Press Ctrl+C to stop.`);

  if (!options.noOpen) {
    openBrowser(url);
  }

  return {
    close: () => new Promise<void>((resolveC) => {
      void stopPreviewProcess().finally(() => {
        server.close(() => resolveC());
      });
    }),
    port,
    url
  };
}
