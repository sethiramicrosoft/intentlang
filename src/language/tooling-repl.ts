import {
  evaluateExpression,
  inferExpressionType,
  parseExpression,
  type FunctionTypeEnvironment,
  type FunctionValueEnvironment,
  type TypeEnvironment,
  type ValueEnvironment
} from "./typed-expressions.js";
import {
  executeQuery,
  planQuery,
  type QueryDefinition,
  type QueryExecutionContext
} from "./typed-queries.js";

export function evaluateExpressionRepl(input: {
  expression: string;
  types?: TypeEnvironment;
  values?: ValueEnvironment;
  functionTypes?: FunctionTypeEnvironment;
  functions?: FunctionValueEnvironment;
}) {
  const expression = parseExpression(input.expression);
  const type = inferExpressionType(
    expression,
    input.types ?? {},
    input.functionTypes ?? {}
  );
  const value = evaluateExpression(
    expression,
    input.types ?? {},
    input.values ?? {},
    input.functionTypes ?? {},
    input.functions ?? {}
  );
  return { type, value };
}

export function evaluateQueryRepl(input: {
  definition: QueryDefinition;
  context: QueryExecutionContext;
}) {
  const plan = planQuery(input.definition);
  return { plan, rows: executeQuery(plan, input.context) };
}
