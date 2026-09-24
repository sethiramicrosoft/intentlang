import {
  buildFunctionProgram,
  evaluateFunction
} from "../src/language/typed-functions.js";
import {
  executeQuery,
  generateSqlQuery,
  planQuery
} from "../src/language/typed-queries.js";
import {
  formatDecimal,
  parseDecimal,
  parseMoney
} from "../src/language/typed-values.js";

const pricing = buildFunctionProgram([
  {
    name: "subtotal",
    parameters: [
      { name: "quantity", type: { kind: "integer" } },
      { name: "unitPrice", type: { kind: "money", currency: "USD", scale: 2 } }
    ],
    returns: { kind: "money", currency: "USD", scale: 2 },
    expression: "unitPrice * quantity"
  },
  {
    name: "priceWithTax",
    parameters: [
      { name: "quantity", type: { kind: "integer" } },
      { name: "unitPrice", type: { kind: "money", currency: "USD", scale: 2 } },
      { name: "taxRate", type: { kind: "decimal", scale: 3 } }
    ],
    returns: { kind: "money", currency: "USD", scale: 5 },
    expression:
      "subtotal(quantity, unitPrice) + subtotal(quantity, unitPrice) * taxRate"
  }
]);

const price = evaluateFunction(pricing, "priceWithTax", [
  3n,
  parseMoney("USD", "19.95"),
  parseDecimal("0.0825")
]);
if (typeof price === "object" && price?.kind === "money") {
  console.log(`Exact price: ${price.currency} ${formatDecimal(price.amount)}`);
}

const orders = {
  name: "Order",
  fields: {
    ownerId: { kind: "integer" } as const,
    category: { kind: "text" } as const,
    total: { kind: "money", currency: "USD", scale: 2 } as const,
    status: { kind: "text" } as const
  }
};
const analytics = planQuery({
  name: "paidRevenue",
  source: orders,
  where: 'status = "paid"',
  groupBy: ["category"],
  aggregates: [
    { name: "orders", operation: "count" },
    { name: "revenue", operation: "sum", field: "total" }
  ],
  orderBy: [{ field: "revenue", direction: "descending" }]
});

const visible = executeQuery(analytics, {
  rows: {
    Order: [
      {
        ownerId: 7n,
        category: "Books",
        total: parseMoney("USD", "20.00"),
        status: "paid"
      },
      {
        ownerId: 8n,
        category: "Books",
        total: parseMoney("USD", "999.00"),
        status: "paid"
      }
    ]
  },
  authorize: (_source, row) => row.ownerId === 7n
});
console.log("Authorized analytics:", visible);

const sql = generateSqlQuery(analytics, {
  Order: { sql: '"Order"."ownerId" = ?', parameters: [7n] }
});
console.log(sql.sql);
console.log("SQL parameters:", sql.parameters);
