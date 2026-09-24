import {
  evaluateExpression,
  inferExpressionType,
  parseExpression,
  type Expression,
  type TypeEnvironment,
  type ValueEnvironment,
  type ValueType
} from "./typed-expressions.js";
import {
  addDecimal,
  addMoney,
  divideDecimal,
  type DecimalValue,
  type MoneyValue,
  type TypedValue,
  TypedExpressionError
} from "./typed-values.js";

export interface QuerySource {
  name: string;
  fields: TypeEnvironment;
}

export interface QueryJoin {
  source: QuerySource;
  localField: string;
  foreignField: string;
  alias: string;
}

export interface QueryAggregate {
  name: string;
  operation: "count" | "sum" | "average" | "minimum" | "maximum";
  field?: string;
}

export interface QueryDefinition {
  name: string;
  source: QuerySource;
  joins?: QueryJoin[];
  where?: string;
  orderBy?: Array<{ field: string; direction: "ascending" | "descending" }>;
  groupBy?: string[];
  aggregates?: QueryAggregate[];
}

export interface QueryPlan {
  name: string;
  source: QuerySource;
  joins: QueryJoin[];
  where?: Expression;
  orderBy: Array<{ field: string; direction: "ascending" | "descending" }>;
  groupBy: string[];
  aggregates: QueryAggregate[];
  authorizationRequired: true;
}

export type QueryRow = Readonly<Record<string, TypedValue>>;

export interface QueryExecutionContext {
  rows: Record<string, readonly QueryRow[]>;
  authorize: (source: string, row: QueryRow) => boolean;
}

export interface SqlAuthorizationPredicate {
  sql: string;
  parameters: TypedValue[];
}

export interface GeneratedSqlQuery {
  sql: string;
  parameters: TypedValue[];
}

function requireField(
  fields: TypeEnvironment,
  name: string,
  context: string
): ValueType {
  const type = fields[name];
  if (!type) {
    throw new TypedExpressionError(
      "X050",
      `${context} references unknown field "${name}".`
    );
  }
  return type;
}

export function planQuery(definition: QueryDefinition): QueryPlan {
  const environment: TypeEnvironment = { ...definition.source.fields };
  const aliases = new Set<string>();
  for (const join of definition.joins ?? []) {
    if (aliases.has(join.alias)) {
      throw new TypedExpressionError(
        "X051",
        `Query "${definition.name}" repeats join alias "${join.alias}".`
      );
    }
    aliases.add(join.alias);
    const local = requireField(
      definition.source.fields,
      join.localField,
      `Join ${join.alias}`
    );
    const foreign = requireField(
      join.source.fields,
      join.foreignField,
      `Join ${join.alias}`
    );
    if (local.kind !== foreign.kind) {
      throw new TypedExpressionError(
        "X051",
        `Join ${join.alias} compares ${local.kind} with ${foreign.kind}.`
      );
    }
    for (const [field, type] of Object.entries(join.source.fields)) {
      environment[`${join.alias}.${field}`] = type;
    }
  }
  let where: Expression | undefined;
  if (definition.where) {
    where = parseExpression(definition.where);
    const result = inferExpressionType(where, environment);
    if (result.kind !== "boolean") {
      throw new TypedExpressionError(
        "X052",
        `Query "${definition.name}" filter must be boolean, not ${result.kind}.`
      );
    }
  }
  for (const field of definition.groupBy ?? []) {
    requireField(environment, field, `Group in ${definition.name}`);
  }
  for (const aggregate of definition.aggregates ?? []) {
    if (aggregate.operation === "count") continue;
    if (!aggregate.field) {
      throw new TypedExpressionError(
        "X053",
        `Aggregate "${aggregate.name}" requires a field.`
      );
    }
    const type = requireField(
      environment,
      aggregate.field,
      `Aggregate ${aggregate.name}`
    );
    if (
      (aggregate.operation === "sum" ||
        aggregate.operation === "average") &&
      !["integer", "decimal", "money"].includes(type.kind)
    ) {
      throw new TypedExpressionError(
        "X053",
        `${aggregate.operation} requires integer, decimal, or money, not ${type.kind}.`
      );
    }
    environment[aggregate.name] =
      aggregate.operation === "average" && type.kind === "integer"
        ? { kind: "decimal", scale: 18 }
        : type;
  }
  for (const aggregate of definition.aggregates ?? []) {
    if (aggregate.operation === "count") {
      environment[aggregate.name] = { kind: "integer" };
    }
  }
  for (const ordering of definition.orderBy ?? []) {
    requireField(environment, ordering.field, `Order in ${definition.name}`);
  }
  return {
    name: definition.name,
    source: definition.source,
    joins: definition.joins ?? [],
    where,
    orderBy: definition.orderBy ?? [],
    groupBy: definition.groupBy ?? [],
    aggregates: definition.aggregates ?? [],
    authorizationRequired: true
  };
}

function compare(left: TypedValue, right: TypedValue): number {
  if (typeof left === "bigint" && typeof right === "bigint") {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right, "en");
  }
  if (
    typeof left === "object" &&
    left?.kind === "decimal" &&
    typeof right === "object" &&
    right?.kind === "decimal"
  ) {
    const leftText = left.coefficient * 10n ** BigInt(right.scale);
    const rightText = right.coefficient * 10n ** BigInt(left.scale);
    return leftText < rightText ? -1 : leftText > rightText ? 1 : 0;
  }
  if (
    typeof left === "object" &&
    left?.kind === "money" &&
    typeof right === "object" &&
    right?.kind === "money"
  ) {
    if (left.currency !== right.currency) {
      throw new TypedExpressionError(
        "X008",
        `Currency mismatch: ${left.currency} and ${right.currency}.`
      );
    }
    return compare(left.amount, right.amount);
  }
  const leftText = JSON.stringify(left);
  const rightText = JSON.stringify(right);
  return leftText.localeCompare(rightText, "en");
}

function sum(values: TypedValue[]): TypedValue {
  if (values.length === 0) return 0n;
  return values.slice(1).reduce((total, value) => {
    if (typeof total === "bigint" && typeof value === "bigint") {
      return total + value;
    }
    if (
      typeof total === "object" &&
      total?.kind === "decimal" &&
      typeof value === "object" &&
      value?.kind === "decimal"
    ) {
      return addDecimal(total, value);
    }
    if (
      typeof total === "object" &&
      total?.kind === "money" &&
      typeof value === "object" &&
      value?.kind === "money"
    ) {
      return addMoney(total, value);
    }
    throw new TypedExpressionError("X053", "Aggregate values have mixed types.");
  }, values[0]!);
}

function average(values: TypedValue[]): TypedValue {
  if (values.length === 0) {
    throw new TypedExpressionError("X054", "Average of an empty group is undefined.");
  }
  const total = sum(values);
  const divisor: DecimalValue = {
    kind: "decimal",
    coefficient: BigInt(values.length),
    scale: 0
  };
  if (typeof total === "bigint") {
    return divideDecimal(
      { kind: "decimal", coefficient: total, scale: 0 },
      divisor
    );
  }
  if (typeof total === "object" && total?.kind === "decimal") {
    return divideDecimal(total, divisor);
  }
  if (typeof total === "object" && total?.kind === "money") {
    return {
      kind: "money",
      currency: total.currency,
      amount: divideDecimal(total.amount, divisor)
    } satisfies MoneyValue;
  }
  throw new TypedExpressionError("X053", "Average requires a numeric value.");
}

function aggregateRows(
  rows: QueryRow[],
  groupBy: string[],
  aggregates: QueryAggregate[]
): QueryRow[] {
  const groups = new Map<string, QueryRow[]>();
  for (const row of rows) {
    const key = groupBy
      .map((field) => {
        const value = row[field];
        if (typeof value === "bigint") return `integer:${value}`;
        if (value === null) return "null";
        if (typeof value !== "object") return `${typeof value}:${String(value)}`;
        if (value.kind === "decimal") {
          return `decimal:${value.coefficient}:${value.scale}`;
        }
        if (value.kind === "money") {
          return `money:${value.currency}:${value.amount.coefficient}:${value.amount.scale}`;
        }
        return `${value.kind}:${JSON.stringify(value)}`;
      })
      .join("|");
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return Array.from(groups.values(), (group) => {
    const result: Record<string, TypedValue> = {};
    for (const field of groupBy) result[field] = group[0]![field]!;
    for (const aggregate of aggregates) {
      const values = aggregate.field
        ? group.map((row) => row[aggregate.field!]!)
        : [];
      if (aggregate.operation === "count") {
        result[aggregate.name] = BigInt(group.length);
      } else if (aggregate.operation === "sum") {
        result[aggregate.name] = sum(values);
      } else if (aggregate.operation === "average") {
        result[aggregate.name] = average(values);
      } else {
        result[aggregate.name] = values.reduce((selected, value) =>
          aggregate.operation === "minimum"
            ? compare(value, selected) < 0
              ? value
              : selected
            : compare(value, selected) > 0
              ? value
              : selected
        );
      }
    }
    return Object.freeze(result);
  });
}

export function executeQuery(
  plan: QueryPlan,
  context: QueryExecutionContext
): readonly QueryRow[] {
  const sourceRows = context.rows[plan.source.name];
  if (!sourceRows) {
    throw new TypedExpressionError(
      "X055",
      `No rows were supplied for source "${plan.source.name}".`
    );
  }
  let rows: QueryRow[] = sourceRows
    .filter((row) => context.authorize(plan.source.name, row))
    .map((row) => Object.freeze({ ...row }));
  for (const join of plan.joins) {
    const foreignRows = (context.rows[join.source.name] ?? []).filter((row) =>
      context.authorize(join.source.name, row)
    );
    rows = rows.flatMap((row) =>
      foreignRows
        .filter(
          (foreign) =>
            compare(row[join.localField]!, foreign[join.foreignField]!) === 0
        )
        .map((foreign) =>
          Object.freeze({
            ...row,
            ...Object.fromEntries(
              Object.entries(foreign).map(([field, value]) => [
                `${join.alias}.${field}`,
                value
              ])
            )
          })
        )
    );
  }
  if (plan.where) {
    rows = rows.filter(
      (row) =>
        evaluateExpression(
          plan.where!,
          {
            ...plan.source.fields,
            ...Object.fromEntries(
              plan.joins.flatMap((join) =>
                Object.entries(join.source.fields).map(([field, type]) => [
                  `${join.alias}.${field}`,
                  type
                ])
              )
            )
          },
          row as ValueEnvironment
        ) === true
    );
  }
  if (plan.groupBy.length > 0 || plan.aggregates.length > 0) {
    rows = aggregateRows(rows, plan.groupBy, plan.aggregates);
  }
  if (plan.orderBy.length > 0) {
    rows.sort((left, right) => {
      for (const ordering of plan.orderBy) {
        const result = compare(left[ordering.field]!, right[ordering.field]!);
        if (result !== 0) {
          return ordering.direction === "ascending" ? result : -result;
        }
      }
      return 0;
    });
  }
  return Object.freeze(rows);
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function sqlField(name: string, sourceName: string): string {
  const dot = name.indexOf(".");
  if (dot === -1) {
    return `${quoteIdentifier(sourceName)}.${quoteIdentifier(name)}`;
  }
  return `${quoteIdentifier(name.slice(0, dot))}.${quoteIdentifier(
    name.slice(dot + 1)
  )}`;
}

function expressionSql(
  expression: Expression,
  sourceName: string,
  parameters: TypedValue[]
): string {
  if (expression.kind === "literal") {
    parameters.push(expression.value);
    return "?";
  }
  if (expression.kind === "variable") {
    return sqlField(expression.name, sourceName);
  }
  if (expression.kind === "call") {
    throw new TypedExpressionError(
      "X056",
      `Function call "${expression.name}" is not supported by the SQL planner.`
    );
  }
  if (expression.kind === "unary") {
    return expression.operator === "not"
      ? `(NOT ${expressionSql(expression.operand, sourceName, parameters)})`
      : `(-${expressionSql(expression.operand, sourceName, parameters)})`;
  }
  if (expression.operator === "??") {
    return `COALESCE(${expressionSql(
      expression.left,
      sourceName,
      parameters
    )}, ${expressionSql(expression.right, sourceName, parameters)})`;
  }
  const operators = {
    "+": "+",
    "-": "-",
    "*": "*",
    "/": "/",
    "=": "=",
    "!=": "<>",
    "<": "<",
    "<=": "<=",
    ">": ">",
    ">=": ">=",
    and: "AND",
    or: "OR"
  } as const;
  return `(${expressionSql(
    expression.left,
    sourceName,
    parameters
  )} ${operators[expression.operator]} ${expressionSql(
    expression.right,
    sourceName,
    parameters
  )})`;
}

export function generateSqlQuery(
  plan: QueryPlan,
  authorization: Record<string, SqlAuthorizationPredicate>
): GeneratedSqlQuery {
  const rootAuthorization = authorization[plan.source.name];
  if (!rootAuthorization) {
    throw new TypedExpressionError(
      "X057",
      `SQL generation requires authorization for "${plan.source.name}".`
    );
  }
  const parameters: TypedValue[] = [];
  const selections = [
    ...plan.groupBy.map(
      (field) => `${sqlField(field, plan.source.name)} AS ${quoteIdentifier(field)}`
    ),
    ...plan.aggregates.map((aggregate) => {
      const operation =
        aggregate.operation === "count"
          ? "COUNT"
          : aggregate.operation === "sum"
            ? "SUM"
            : aggregate.operation === "average"
              ? "AVG"
              : aggregate.operation === "minimum"
                ? "MIN"
                : "MAX";
      const target =
        aggregate.operation === "count"
          ? "*"
          : sqlField(aggregate.field!, plan.source.name);
      return `${operation}(${target}) AS ${quoteIdentifier(aggregate.name)}`;
    })
  ];
  if (selections.length === 0) {
    selections.push(`${quoteIdentifier(plan.source.name)}.*`);
  }
  const joins = plan.joins.map((join) => {
    const predicate = authorization[join.source.name];
    if (!predicate) {
      throw new TypedExpressionError(
        "X057",
        `SQL generation requires authorization for joined source "${join.source.name}".`
      );
    }
    parameters.push(...predicate.parameters);
    return `INNER JOIN ${quoteIdentifier(join.source.name)} AS ${quoteIdentifier(
      join.alias
    )} ON ${sqlField(join.localField, plan.source.name)} = ${sqlField(
      `${join.alias}.${join.foreignField}`,
      plan.source.name
    )} AND (${predicate.sql})`;
  });
  const filters = [`(${rootAuthorization.sql})`];
  parameters.push(...rootAuthorization.parameters);
  if (plan.where) {
    filters.push(expressionSql(plan.where, plan.source.name, parameters));
  }
  const groups =
    plan.groupBy.length > 0
      ? ` GROUP BY ${plan.groupBy
          .map((field) => sqlField(field, plan.source.name))
          .join(", ")}`
      : "";
  const orders =
    plan.orderBy.length > 0
      ? ` ORDER BY ${plan.orderBy
          .map(
            (ordering) =>
              `${quoteIdentifier(ordering.field)} ${
                ordering.direction === "ascending" ? "ASC" : "DESC"
              }`
          )
          .join(", ")}`
      : "";
  return {
    sql: `SELECT ${selections.join(", ")} FROM ${quoteIdentifier(
      plan.source.name
    )}${joins.length > 0 ? ` ${joins.join(" ")}` : ""} WHERE ${filters.join(
      " AND "
    )}${groups}${orders}`,
    parameters
  };
}
