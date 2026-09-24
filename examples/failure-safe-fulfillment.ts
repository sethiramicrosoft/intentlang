import { createHash } from "node:crypto";
import { EscapeHatchRuntime } from "../src/language/escape-hatches.js";
import { ExternalContractRuntime } from "../src/language/integrations.js";
import {
  fingerprintTransactionRequest,
  TransactionRuntime
} from "../src/language/transactions.js";

const database = new TransactionRuntime({
  Order: { "order-1": { status: "pending" } },
  Outbox: {}
});

await database.execute(
  {
    name: "confirmOrder",
    steps: [
      {
        name: "change order state",
        execute: (transaction) =>
          transaction.put("Order", "order-1", { status: "confirmed" })
      },
      {
        name: "queue billing request",
        execute: (transaction) =>
          transaction.put("Outbox", "charge-order-1", {
            operation: "charge",
            amount: "20.00"
          })
      }
    ]
  },
  {
    idempotencyKey: "confirm-order-1",
    requestFingerprint: fingerprintTransactionRequest({ orderId: "order-1" })
  }
);

let attempts = 0;
const billing = new ExternalContractRuntime(
  async () => {
    attempts += 1;
    return attempts === 1
      ? { status: 503, body: { unavailable: true } }
      : { status: 200, body: { receiptId: "receipt-1" } };
  },
  async () => process.env.BILLING_TOKEN ?? "development-reference-only"
);
const receipt = await billing.invoke(
  {
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
  },
  "charge",
  { amount: "20.00" },
  { idempotencyKey: "charge-order-1" }
);

const transform = new EscapeHatchRuntime(
  new Set(["receipt:format"]),
  async ({ input }) => ({ label: `Receipt ${String(input.receiptId)}` })
);
const label = await transform.execute(
  {
    name: "formatReceipt",
    sourceFingerprint: createHash("sha256")
      .update("format receipt label")
      .digest("hex"),
    requiredCapabilities: ["receipt:format"],
    excludedGuarantees: ["cross-backend semantic equivalence"],
    timeoutMs: 1_000
  },
  receipt
);

console.log("Committed state:", database.snapshot());
console.log("Billing attempts:", attempts);
console.log("Receipt label:", label);
console.log("Transaction audit:", database.audit);
console.log("Integration audit:", billing.audit);
console.log("Escape audit:", transform.audit);
