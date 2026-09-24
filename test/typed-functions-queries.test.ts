import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFunctionProgram,
  evaluateFunction
} from "../src/language/typed-functions.js";
import {
  createRecord,
  filterCollection,
  foldCollection,
  mapCollection,
  matchEnum
} from "../src/language/typed-collections.js";
import {
  executeQuery,
  generateSqlQuery,
  planQuery
} from "../src/language/typed-queries.js";
import {
  formatDecimal,
  parseDecimal,
  parseMoney,
  TypedExpressionError
} from "../src/language/typed-values.js";

test("pure functions compose with left-to-right argument evaluation", () => {
  const program = buildFunctionProgram([
    {
      name: "subtotal",
      parameters: [
        { name: "quantity", type: { kind: "integer" } },
        {
          name: "unitPrice",
          type: { kind: "money", currency: "AUD", scale: 2 }
        }
      ],
      returns: { kind: "money", currency: "AUD", scale: 2 },
      expression: "unitPrice * quantity"
    },
    {
      name: "withTax",
      parameters: [
        {
          name: "amount",
          type: { kind: "money", currency: "AUD", scale: 2 }
        },
        { name: "rate", type: { kind: "decimal", scale: 2 } }
      ],
      returns: { kind: "money", currency: "AUD", scale: 2 },
      expression: "amount + amount * rate"
    },
    {
      name: "lineTotal",
      parameters: [
        { name: "quantity", type: { kind: "integer" } },
        {
          name: "unitPrice",
          type: { kind: "money", currency: "AUD", scale: 2 }
        },
        { name: "rate", type: { kind: "decimal", scale: 2 } }
      ],
      returns: { kind: "money", currency: "AUD", scale: 2 },
      expression: "withTax(subtotal(quantity, unitPrice), rate)"
    }
  ]);
  const result = evaluateFunction(program, "lineTotal", [
    3n,
    parseMoney("AUD", "19.95"),
    parseDecimal("0.10")
  ]);
  assert.equal(
    result !== null && typeof result === "object" && result.kind === "money"
      ? formatDecimal(result.amount)
      : "",
    "65.835"
  );
});

test("recursive functions and undeclared procedure effects fail explicitly", () => {
  assert.throws(
    () =>
      buildFunctionProgram([
        {
          name: "again",
          parameters: [{ name: "value", type: { kind: "integer" } }],
          returns: { kind: "integer" },
          expression: "again(value)"
        }
      ]),
    (error: unknown) =>
      error instanceof TypedExpressionError && error.code === "X029"
  );
  assert.throws(
    () =>
      buildFunctionProgram([], [
        {
          name: "sendInvoice",
          parameters: [],
          effects: [],
          steps: ["send invoice"],
          effect: "procedure"
        }
      ]),
    (error: unknown) =>
      error instanceof TypedExpressionError && error.code === "X032"
  );
});

test("records, immutable collection operations, and exhaustive enum matching work", () => {
  const record = createRecord(
    { name: "Line", fields: ["quantity", "sku"] },
    { quantity: 2n, sku: "A-1" }
  );
  assert.equal(record.sku, "A-1");
  const doubled = mapCollection([1n, 2n], (value) =>
    typeof value === "bigint" ? value * 2n : value
  );
  assert.deepEqual(doubled, [2n, 4n]);
  assert.deepEqual(
    filterCollection(doubled, (value) => value === 4n),
    [4n]
  );
  assert.equal(
    foldCollection(doubled, 0n, (total, value) =>
      typeof total === "bigint" && typeof value === "bigint"
        ? total + value
        : total
    ),
    6n
  );
  assert.equal(
    matchEnum("Health", ["green", "amber", "red"], "amber", {
      green: () => 1,
      amber: () => 2,
      red: () => 3
    }),
    2
  );
  assert.throws(() =>
    matchEnum("Health", ["green", "amber", "red"], "amber", {
      green: () => 1,
      amber: () => 2
    })
  );
});

test("queries enforce authorization before joins, filtering, grouping, and aggregation", () => {
  const orders = {
    name: "Order",
    fields: {
      id: { kind: "integer" } as const,
      ownerId: { kind: "integer" } as const,
      categoryId: { kind: "integer" } as const,
      total: { kind: "money", currency: "AUD", scale: 2 } as const,
      status: { kind: "text" } as const
    }
  };
  const categories = {
    name: "Category",
    fields: {
      id: { kind: "integer" } as const,
      name: { kind: "text" } as const
    }
  };
  const plan = planQuery({
    name: "revenueByCategory",
    source: orders,
    joins: [
      {
        source: categories,
        localField: "categoryId",
        foreignField: "id",
        alias: "category"
      }
    ],
    where: 'status = "paid"',
    groupBy: ["category.name"],
    aggregates: [
      { name: "orders", operation: "count" },
      { name: "revenue", operation: "sum", field: "total" }
    ],
    orderBy: [{ field: "revenue", direction: "descending" }]
  });
  const rows = executeQuery(plan, {
    rows: {
      Order: [
        {
          id: 1n,
          ownerId: 7n,
          categoryId: 1n,
          total: parseMoney("AUD", "20.00"),
          status: "paid"
        },
        {
          id: 2n,
          ownerId: 8n,
          categoryId: 1n,
          total: parseMoney("AUD", "1000.00"),
          status: "paid"
        },
        {
          id: 3n,
          ownerId: 7n,
          categoryId: 2n,
          total: parseMoney("AUD", "35.00"),
          status: "paid"
        }
      ],
      Category: [
        { id: 1n, name: "Books" },
        { id: 2n, name: "Tools" }
      ]
    },
    authorize: (source, row) =>
      source !== "Order" || row.ownerId === 7n
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!["category.name"], "Tools");
  assert.equal(rows[1]!["category.name"], "Books");
  const books = rows[1]!["revenue"];
  assert.equal(
    books !== null && typeof books === "object" && books.kind === "money"
      ? formatDecimal(books.amount)
      : "",
    "20"
  );
  const generated = generateSqlQuery(plan, {
    Order: { sql: '"Order"."ownerId" = ?', parameters: [7n] },
    Category: { sql: "1 = 1", parameters: [] }
  });
  assert.match(
    generated.sql,
    /WHERE \("Order"\."ownerId" = \?\) AND \("Order"\."status" = \?\)/
  );
  assert.doesNotMatch(generated.sql, /1000\.00/);
  assert.deepEqual(generated.parameters, [7n, "paid"]);
});
