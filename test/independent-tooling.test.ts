import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";
import { compileSource } from "../src/compiler.js";
import { buildManifest } from "../src/manifest.js";
import { validateBackendParity } from "../src/language/backend-parity.js";
import { runConformance } from "../src/language/conformance-runner.js";
import {
  debugAuthorization,
  debugRequest,
  debugWorkflow
} from "../src/language/debugger.js";
import {
  codeActions,
  completionsAt,
  definitionAt,
  documentSymbols,
  hoverAt,
  moduleLinks,
  referencesAt,
  renameAt,
  semanticTokens,
  traceLinks
} from "../src/language/language-service.js";
import { validateSemanticManifest } from "../src/language/manifest-validator.js";
import { evaluateExpressionRepl, evaluateQueryRepl } from "../src/language/tooling-repl.js";
import { formatDecimal, parseDecimal, parseMoney } from "../src/language/typed-values.js";

const source = `application Work
authentication uses User identified by email
role Member
a User has a required unique email as text
a Task has a required title as text
a Task has a done as boolean default false
each Task belongs to a User as owner on delete restrict
action complete a Task
  require done is false otherwise "Already complete"
  set done to true
allow Member to read Task where owner is self
allow Member to run complete on Task where owner is self
`;

function program() {
  const result = compileSource(source);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("compile failed");
  return result.ir;
}

test("language service exposes symbols, navigation, rename, hover, completion, actions, tokens, modules, and trace", () => {
  const symbols = documentSymbols(source);
  assert.ok(symbols.some((symbol) => symbol.name === "Task" && symbol.kind === "entity"));
  const taskReferenceLine = source.split("\n").findIndex((line) => line.startsWith("action complete"));
  const position = { line: taskReferenceLine, character: 20 };
  assert.equal(definitionAt(source, "file:///work.intent", position)?.range.start.line, 4);
  assert.ok(referencesAt(source, "file:///work.intent", position).length >= 5);
  const rename = renameAt(source, "file:///work.intent", position, "WorkItem");
  assert.ok(rename.changes["file:///work.intent"]!.length >= 5);
  assert.match(hoverAt(source, position)?.contents ?? "", /entity Task/);
  assert.ok(completionsAt(source, { line: 9, character: 6 }).length > 0);
  assert.ok(semanticTokens(source).some((token) => token.tokenType === "type"));
  assert.ok(traceLinks(source, "file:///work.intent").some((link) => link.irNodeId === "task-complete"));
  assert.deepEqual(
    moduleLinks('import "./domain.intent" as Domain', "file:///project/main.intent")[0],
    {
      range: {
        start: { line: 0, character: 8 },
        end: { line: 0, character: 23 }
      },
      target: "file:///project/domain.intent",
      alias: "Domain"
    }
  );
  assert.equal(codeActions("entity Task with id task")[0]?.diagnosticCode, "E004");
});

test("typed expression and query REPLs preserve exact values and authorization", () => {
  const expression = evaluateExpressionRepl({
    expression: "price * quantity + tax",
    types: {
      price: { kind: "decimal", scale: 2 },
      quantity: { kind: "integer" },
      tax: { kind: "decimal", scale: 2 }
    },
    values: {
      price: parseDecimal("19.95"),
      quantity: 2n,
      tax: parseDecimal("1.10")
    }
  });
  assert.equal(
    typeof expression.value === "object" && expression.value?.kind === "decimal"
      ? formatDecimal(expression.value)
      : "",
    "41"
  );
  const query = evaluateQueryRepl({
    definition: {
      name: "visibleRevenue",
      source: {
        name: "Order",
        fields: {
          ownerId: { kind: "integer" },
          total: { kind: "money", currency: "USD", scale: 2 }
        }
      },
      aggregates: [{ name: "revenue", operation: "sum", field: "total" }]
    },
    context: {
      rows: {
        Order: [
          { ownerId: 7n, total: parseMoney("USD", "20.00") },
          { ownerId: 8n, total: parseMoney("USD", "999.00") }
        ]
      },
      authorize: (_sourceName, row) => row.ownerId === 7n
    }
  });
  const revenue = query.rows[0]?.revenue;
  assert.equal(
    typeof revenue === "object" && revenue?.kind === "money"
      ? formatDecimal(revenue.amount)
      : "",
    "20"
  );
});

test("workflow and request debugger explain default deny, scope, and preconditions", () => {
  const ir = program();
  const denied = debugAuthorization(ir, {
    role: "Member",
    operation: "read",
    entity: "Task",
    identityId: "user-1",
    record: { id: "task-1", owner_id: "user-2", done: false }
  });
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /scope failed/);
  const workflow = debugWorkflow(ir, "Task", "complete", {
    id: "task-1",
    owner_id: "user-1",
    done: false
  });
  assert.equal(workflow.allowed, true);
  assert.equal(workflow.projectedRecord?.done, true);
  const request = debugRequest(ir, {
    role: "Member",
    operation: "run",
    entity: "Task",
    action: "complete",
    identityId: "user-1",
    record: { id: "task-1", owner_id: "user-1", done: true }
  });
  assert.equal(request.authorization.allowed, true);
  assert.equal(request.workflow?.allowed, false);
  assert.equal(request.allowed, false);
});

test("standalone conformance, manifest validation, and backend parity are independently callable", async () => {
  const conformance = await runConformance({
    categories: ["valid", "invalid", "canonical", "runtime"]
  });
  assert.equal(conformance.passed, true);
  assert.ok(conformance.total >= 30);
  const ir = program();
  const manifest = buildManifest(ir);
  assert.deepEqual(validateSemanticManifest(manifest), { valid: true, errors: [] });
  assert.equal(
    validateSemanticManifest({ ...manifest, semanticFingerprint: "sha256:bad" }).valid,
    false
  );
  assert.equal(
    validateSemanticManifest({ ...manifest, compilerVersion: "0.7.0" }).valid,
    false
  );
  const parity = validateBackendParity(ir);
  assert.equal(parity.valid, true, JSON.stringify(parity.failures, null, 2));
  const broken = validateBackendParity(ir, { ui: "" });
  assert.equal(broken.valid, false);
  assert.ok(broken.failures.some((failure) => failure.backend === "ui"));
});

test("stdio LSP server completes the initialize handshake", async () => {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", resolve("src/language/lsp-server.ts")],
    { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] }
  );
  const request = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {}
  });
  child.stdin.write(`Content-Length: ${Buffer.byteLength(request)}\r\n\r\n${request}`);
  const response = await new Promise<string>((resolveResponse, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error("LSP initialize timed out.")), 5_000);
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
      const separator = output.indexOf("\r\n\r\n");
      if (separator < 0) return;
      const length = Number(/Content-Length:\s*(\d+)/i.exec(output.slice(0, separator))?.[1]);
      const body = output.slice(separator + 4);
      if (body.length < length) return;
      clearTimeout(timeout);
      resolveResponse(body.slice(0, length));
    });
    child.once("error", reject);
  });
  child.kill();
  const parsed = JSON.parse(response) as {
    result: { capabilities: { renameProvider: boolean } };
  };
  assert.equal(parsed.result.capabilities.renameProvider, true);
});
