import {
  evaluateExpression,
  inferExpressionType,
  parseExpression,
  typeEquals,
  type Expression,
  type FunctionSignature,
  type FunctionTypeEnvironment,
  type FunctionValueEnvironment,
  type TypeEnvironment,
  type ValueEnvironment,
  type ValueType
} from "./typed-expressions.js";
import {
  type TypedValue,
  TypedExpressionError
} from "./typed-values.js";

export interface FunctionParameter {
  name: string;
  type: ValueType;
}

export interface TypedFunction {
  name: string;
  parameters: FunctionParameter[];
  returns: ValueType;
  body: Expression;
  effect: "pure";
}

export interface TypedProcedure {
  name: string;
  parameters: FunctionParameter[];
  effects: string[];
  steps: string[];
  effect: "procedure";
}

export interface FunctionProgram {
  functions: TypedFunction[];
  procedures: TypedProcedure[];
}

export function buildFunctionProgram(
  functions: Array<{
    name: string;
    parameters: FunctionParameter[];
    returns: ValueType;
    expression: string;
  }>,
  procedures: TypedProcedure[] = []
): FunctionProgram {
  const names = new Set<string>();
  for (const definition of [...functions, ...procedures]) {
    if (names.has(definition.name)) {
      throw new TypedExpressionError(
        "X030",
        `Callable "${definition.name}" is declared more than once.`
      );
    }
    names.add(definition.name);
  }
  const signatures: FunctionTypeEnvironment = Object.fromEntries(
    functions.map((definition) => [
      definition.name,
      {
        parameters: definition.parameters.map((parameter) => parameter.type),
        returns: definition.returns
      }
    ])
  );
  const typedFunctions = functions.map((definition): TypedFunction => {
    const body = parseExpression(definition.expression);
    const environment = Object.fromEntries(
      definition.parameters.map((parameter) => [
        parameter.name,
        parameter.type
      ])
    );
    const actual = inferExpressionType(body, environment, signatures);
    if (!typeEquals(actual, definition.returns)) {
      throw new TypedExpressionError(
        "X031",
        `Function "${definition.name}" returns a value incompatible with its declared type.`
      );
    }
    return {
      name: definition.name,
      parameters: definition.parameters,
      returns: definition.returns,
      body,
      effect: "pure"
    };
  });
  for (const procedure of procedures) {
    if (procedure.effects.length === 0) {
      throw new TypedExpressionError(
        "X032",
        `Procedure "${procedure.name}" must declare at least one effect.`
      );
    }
    if (procedure.steps.length === 0) {
      throw new TypedExpressionError(
        "X032",
        `Procedure "${procedure.name}" must declare at least one step.`
      );
    }
  }
  const byName = Object.fromEntries(
    typedFunctions.map((definition) => [definition.name, definition])
  );
  const calls = (expression: Expression): string[] => {
    if (expression.kind === "call") {
      return [
        expression.name,
        ...expression.arguments.flatMap((argument) => calls(argument))
      ];
    }
    if (expression.kind === "unary") return calls(expression.operand);
    if (expression.kind === "binary") {
      return [...calls(expression.left), ...calls(expression.right)];
    }
    return [];
  };
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (name: string, path: string[]): void => {
    if (visiting.has(name)) {
      throw new TypedExpressionError(
        "X029",
        `Recursive function cycle is not allowed: ${[...path, name].join(" -> ")}.`
      );
    }
    if (visited.has(name)) return;
    visiting.add(name);
    for (const dependency of calls(byName[name]!.body)) {
      if (byName[dependency]) visit(dependency, [...path, name]);
    }
    visiting.delete(name);
    visited.add(name);
  };
  for (const name of Object.keys(byName)) visit(name, []);
  return { functions: typedFunctions, procedures };
}

export function evaluateFunction(
  program: FunctionProgram,
  name: string,
  values: TypedValue[]
): TypedValue {
  const definition = program.functions.find((candidate) => candidate.name === name);
  if (!definition) {
    throw new TypedExpressionError("X027", `Function "${name}" is not declared.`);
  }
  const functionTypes: FunctionTypeEnvironment = Object.fromEntries(
    program.functions.map((candidate): [string, FunctionSignature] => [
      candidate.name,
      {
        parameters: candidate.parameters.map((parameter) => parameter.type),
        returns: candidate.returns
      }
    ])
  );
  const functions: FunctionValueEnvironment = Object.fromEntries(
    program.functions.map((candidate) => [
      candidate.name,
      {
        parameters: candidate.parameters.map((parameter) => parameter.name),
        body: candidate.body
      }
    ])
  );
  const types: TypeEnvironment = Object.fromEntries(
    definition.parameters.map((parameter) => [parameter.name, parameter.type])
  );
  const environment: ValueEnvironment = Object.fromEntries(
    definition.parameters.map((parameter, index) => [
      parameter.name,
      values[index]!
    ])
  );
  if (values.length !== definition.parameters.length) {
    throw new TypedExpressionError(
      "X028",
      `Function "${name}" expects ${definition.parameters.length} arguments, not ${values.length}.`
    );
  }
  return evaluateExpression(
    definition.body,
    types,
    environment,
    functionTypes,
    functions,
    [name]
  );
}
