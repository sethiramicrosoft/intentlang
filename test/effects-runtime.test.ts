import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { EffectRuntimeError } from "../src/language/effects-errors.js";
import { EscapeHatchRuntime } from "../src/language/escape-hatches.js";
import {
  ExternalContractRuntime,
  type ExternalContract
} from "../src/language/integrations.js";
import {
  fingerprintTransactionRequest,
  TransactionRuntime
} from "../src/language/transactions.js";

test("multi-record transactions commit atomically and replay safely", async () => {
  const runtime = new TransactionRuntime({
    Account: {
      source: { balance: 100n },
      destination: { balance: 5n }
    }
  });
  const request = { amount: 25n };
  const invocation = {
    idempotencyKey: "transfer-1",
    requestFingerprint: fingerprintTransactionRequest(request)
  };
  const transaction = {
    name: "transferFunds",
    steps: [
      {
        name: "debit source",
        execute: (context: Parameters<Parameters<typeof runtime.execute>[0]["steps"][0]["execute"]>[0]) => {
          context.put("Account", "source", { balance: 75n });
        }
      },
      {
        name: "credit destination",
        execute: (context: Parameters<Parameters<typeof runtime.execute>[0]["steps"][0]["execute"]>[0]) => {
          context.put("Account", "destination", { balance: 30n });
        }
      }
    ]
  };
  const first = await runtime.execute(transaction, invocation);
  const replay = await runtime.execute(transaction, invocation);
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.deepEqual(runtime.snapshot().Account, {
    source: { balance: 75n },
    destination: { balance: 30n }
  });
  await assert.rejects(
    runtime.execute(transaction, {
      ...invocation,
      requestFingerprint: fingerprintTransactionRequest({ amount: 30n })
    }),
    (error: unknown) =>
      error instanceof EffectRuntimeError && error.code === "I006"
  );
  assert.equal(
    fingerprintTransactionRequest({ amount: 25n, account: "source" }),
    fingerprintTransactionRequest({ account: "source", amount: 25n })
  );
});

test("failure injection rolls back every transaction write", async () => {
  const runtime = new TransactionRuntime({
    Order: { "1": { status: "pending" } },
    Outbox: {}
  });
  await assert.rejects(
    runtime.execute(
      {
        name: "confirmOrder",
        steps: [
          {
            name: "confirm",
            execute: (context) =>
              context.put("Order", "1", { status: "confirmed" })
          },
          {
            name: "write outbox",
            execute: (context) => {
              context.put("Outbox", "1", { event: "OrderConfirmed" });
              throw new Error("injected disk failure");
            }
          }
        ]
      },
      {
        idempotencyKey: "confirm-1",
        requestFingerprint: fingerprintTransactionRequest({ order: 1 })
      }
    )
  );
  assert.deepEqual(runtime.snapshot(), {
    Order: { "1": { status: "pending" } },
    Outbox: {}
  });
  assert.equal(runtime.audit.at(-1)?.outcome, "rolled-back");
  assert.doesNotMatch(
    runtime.audit.at(-1)?.cause ?? "",
    /injected disk failure/
  );
});

test("external contracts retry bounded idempotent calls without leaking secrets", async () => {
  const resolvedValue = createHash("sha256")
    .update(`${process.pid}:${performance.now()}`)
    .digest("hex");
  let attempts = 0;
  const runtime = new ExternalContractRuntime(
    async (request) => {
      attempts += 1;
      assert.equal(
        request.headers["x-intentlang-secret-billing-token"],
        resolvedValue
      );
      return attempts === 1
        ? { status: 503, body: { error: "busy" } }
        : { status: 200, body: { receiptId: "receipt-1" } };
    },
    async (reference) => {
      assert.equal(reference, "billing-token");
      return resolvedValue;
    }
  );
  const contract: ExternalContract = {
    name: "Billing",
    baseUrl: "https://billing.example/",
    operations: [
      {
        name: "charge",
        method: "POST",
        path: "/charges",
        requestFields: ["amount"],
        responseFields: ["receiptId"],
        timeoutMs: 1_000,
        maximumAttempts: 2,
        retryableStatuses: [503],
        idempotent: true,
        secretReferences: ["billing-token"]
      }
    ]
  };
  assert.deepEqual(await runtime.invoke(contract, "charge", { amount: "20.00" }), {
    receiptId: "receipt-1"
  });
  assert.equal(attempts, 2);
  assert.doesNotMatch(JSON.stringify(runtime.audit), new RegExp(resolvedValue));
  assert.deepEqual(runtime.audit[0]?.secretReferences, ["billing-token"]);
});

test("external responses are closed and failures are secret-safe", async () => {
  const resolvedValue = createHash("sha256")
    .update(`${process.pid}:${performance.now()}:response`)
    .digest("hex");
  const runtime = new ExternalContractRuntime(
    async () => ({
      status: 200,
      body: { receiptId: "r1", unexpected: resolvedValue }
    }),
    async () => resolvedValue
  );
  await assert.rejects(
    runtime.invoke(
      {
        name: "Billing",
        baseUrl: "https://billing.example/",
        operations: [
          {
            name: "charge",
            method: "POST",
            path: "/charge",
            requestFields: [],
            responseFields: ["receiptId"],
            timeoutMs: 1_000,
            maximumAttempts: 1,
            retryableStatuses: [],
            idempotent: true,
            secretReferences: ["billing-token"]
          }
        ]
      },
      "charge",
      {}
    )
  );
  assert.doesNotMatch(JSON.stringify(runtime.audit), new RegExp(resolvedValue));
  assert.equal(runtime.audit[0]?.cause?.includes(resolvedValue), false);
});

test("secret resolver failures expose only the symbolic reference", async () => {
  const runtime = new ExternalContractRuntime(
    async () => ({ status: 200, body: {} }),
    async () => {
      throw new Error(`resolver failure ${performance.now()}`);
    }
  );
  await assert.rejects(
    runtime.invoke(
      {
        name: "Vaulted",
        baseUrl: "https://vaulted.example/",
        operations: [
          {
            name: "read",
            method: "GET",
            path: "/data",
            requestFields: [],
            responseFields: [],
            timeoutMs: 100,
            maximumAttempts: 1,
            retryableStatuses: [],
            idempotent: true,
            secretReferences: ["service-token"]
          }
        ]
      },
      "read",
      {}
    ),
    (error: unknown) =>
      error instanceof EffectRuntimeError &&
      error.code === "I015" &&
      !error.message.includes("sensitive")
  );
  assert.doesNotMatch(JSON.stringify(runtime.audit), /sensitive/);
});

test("non-idempotent retries require a per-call key and timeouts are enforced", async () => {
  const contract: ExternalContract = {
    name: "Messages",
    baseUrl: "https://messages.example/",
    operations: [
      {
        name: "send",
        method: "POST",
        path: "/messages",
        requestFields: ["text"],
        responseFields: ["messageId"],
        timeoutMs: 10,
        maximumAttempts: 2,
        retryableStatuses: [503],
        idempotent: false,
        secretReferences: []
      }
    ]
  };
  const runtime = new ExternalContractRuntime(
    async () => new Promise(() => undefined),
    async () => ""
  );
  await assert.rejects(
    runtime.invoke(contract, "send", { text: "hello" }),
    (error: unknown) =>
      error instanceof EffectRuntimeError && error.code === "I013"
  );
  await assert.rejects(
    runtime.invoke(
      contract,
      "send",
      { text: "hello" },
      { idempotencyKey: "message-1" }
    ),
    (error: unknown) =>
      error instanceof EffectRuntimeError &&
      error.code === "I014" &&
      /timed out/.test(error.message)
  );
  assert.equal(runtime.audit.at(-1)?.attempts, 2);
});

test("escape hatches require capabilities and emit source-free audit metadata", async () => {
  const fingerprint = createHash("sha256").update("custom transform").digest("hex");
  const definition = {
    name: "customTransform",
    sourceFingerprint: fingerprint,
    requiredCapabilities: ["records:read"],
    excludedGuarantees: ["cross-backend semantic equivalence"],
    timeoutMs: 1_000
  };
  const denied = new EscapeHatchRuntime(new Set(), async () => "unreachable");
  await assert.rejects(
    denied.execute(definition, {}),
    (error: unknown) =>
      error instanceof EffectRuntimeError && error.code === "I021"
  );
  const runtime = new EscapeHatchRuntime(
    new Set(["records:read"]),
    async ({ input, capabilities }) => ({
      input,
      capability: capabilities[0]
    })
  );
  assert.deepEqual(await runtime.execute(definition, { recordId: "7" }), {
    input: { recordId: "7" },
    capability: "records:read"
  });
  assert.equal(runtime.audit[0]?.sourceFingerprint, fingerprint);
  assert.equal(JSON.stringify(runtime.audit).includes("custom transform"), false);
});

test("escape-hatch timeout does not depend on executor cooperation", async () => {
  const runtime = new EscapeHatchRuntime(
    new Set(["network:read"]),
    async () => new Promise(() => undefined)
  );
  await assert.rejects(
    runtime.execute(
      {
        name: "stuckAdapter",
        sourceFingerprint: createHash("sha256").update("stuck").digest("hex"),
        requiredCapabilities: ["network:read"],
        excludedGuarantees: ["termination"],
        timeoutMs: 10
      },
      {}
    ),
    (error: unknown) =>
      error instanceof EffectRuntimeError &&
      error.code === "I023" &&
      /timed out/.test(error.message)
  );
  assert.equal(runtime.audit[0]?.outcome, "failed");
});
