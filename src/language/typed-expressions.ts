import {
  addDecimal,
  addMoney,
  compareDecimal,
  compareMoney,
  divideDecimal,
  multiplyDecimal,
  parseDecimal,
  subtractDecimal,
  subtractMoney,
  type DecimalValue,
  type MoneyValue,
  type TypedValue,
  TypedExpressionError
} from "./typed-values.js";

export type ValueType =
  | { kind: "integer" }
  | { kind: "decimal"; scale: number }
  | { kind: "money"; currency: string; scale: number }
  | { kind: "text" }
  | { kind: "boolean" }
  | { kind: "date" }
  | { kind: "time" }
  | { kind: "datetime" }
  | { kind: "enum"; name: string; members: string[] }
  | { kind: "optional"; value: ValueType }
  | { kind: "null" };

export type Expression =
  | { kind: "literal"; value: TypedValue; valueType: ValueType }
  | { kind: "variable"; name: string }
  | { kind: "call"; name: string; arguments: Expression[] }
  | { kind: "unary"; operator: "not" | "-"; operand: Expression }
  | {
      kind: "binary";
      operator:
        | "+"
        | "-"
        | "*"
        | "/"
        | "="
        | "!="
        | "<"
        | "<="
        | ">"
        | ">="
        | "and"
        | "or"
        | "??";
      left: Expression;
      right: Expression;
    };

interface Token {
  kind: "number" | "string" | "identifier" | "operator" | "eof";
  text: string;
  position: number;
}

const operatorPrecedence: Record<string, number> = {
  "??": 1,
  or: 2,
  and: 3,
  "=": 4,
  "!=": 4,
  "<": 4,
  "<=": 4,
  ">": 4,
  ">=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6
};

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index]!;
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    const rest = source.slice(index);
    const number = /^\d+(?:\.\d+)?/.exec(rest);
    if (number) {
      tokens.push({ kind: "number", text: number[0], position: index });
      index += number[0].length;
      continue;
    }
    const identifier = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(rest);
    if (identifier) {
      const text = identifier[0];
      tokens.push({
        kind:
          text === "and" || text === "or" || text === "not"
            ? "operator"
            : "identifier",
        text,
        position: index
      });
      index += text.length;
      continue;
    }
    if (char === '"') {
      let cursor = index + 1;
      let escaped = false;
      while (cursor < source.length) {
        const candidate = source[cursor]!;
        if (!escaped && candidate === '"') break;
        escaped = !escaped && candidate === "\\";
        if (candidate !== "\\") escaped = false;
        cursor += 1;
      }
      if (cursor >= source.length) {
        throw new TypedExpressionError("X020", "Unterminated text literal.");
      }
      const text = source.slice(index, cursor + 1);
      tokens.push({ kind: "string", text, position: index });
      index = cursor + 1;
      continue;
    }
    const operator = /^(?:\?\?|!=|<=|>=|[(),+\-*/=<>])/.exec(rest);
    if (operator) {
      tokens.push({
        kind: "operator",
        text: operator[0],
        position: index
      });
      index += operator[0].length;
      continue;
    }
    throw new TypedExpressionError(
      "X020",
      `Unexpected token "${char}" at position ${index + 1}.`
    );
  }
  tokens.push({ kind: "eof", text: "", position: source.length });
  return tokens;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): Expression {
    const expression = this.parseBinary(1);
    if (this.current().kind !== "eof") {
      throw new TypedExpressionError(
        "X020",
        `Unexpected token "${this.current().text}".`
      );
    }
    return expression;
  }

  private current(): Token {
    return this.tokens[this.index]!;
  }

  private consume(): Token {
    const token = this.current();
    this.index += 1;
    return token;
  }

  private parseBinary(minimum: number): Expression {
    let left = this.parseUnary();
    while (true) {
      const operator = this.current().text;
      const precedence = operatorPrecedence[operator];
      if (precedence === undefined || precedence < minimum) break;
      this.consume();
      const right = this.parseBinary(precedence + 1);
      left = {
        kind: "binary",
        operator: operator as Extract<Expression, { kind: "binary" }>["operator"],
        left,
        right
      };
    }
    return left;
  }

  private parseUnary(): Expression {
    if (this.current().text === "not" || this.current().text === "-") {
      const operator = this.consume().text as "not" | "-";
      return { kind: "unary", operator, operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expression {
    const token = this.consume();
    if (token.kind === "number") {
      if (token.text.includes(".")) {
        const value = parseDecimal(token.text);
        return {
          kind: "literal",
          value,
          valueType: { kind: "decimal", scale: value.scale }
        };
      }
      return {
        kind: "literal",
        value: BigInt(token.text),
        valueType: { kind: "integer" }
      };
    }
    if (token.kind === "string") {
      return {
        kind: "literal",
        value: JSON.parse(token.text) as string,
        valueType: { kind: "text" }
      };
    }
    if (token.kind === "identifier") {
      if (token.text === "true" || token.text === "false") {
        return {
          kind: "literal",
          value: token.text === "true",
          valueType: { kind: "boolean" }
        };
      }
      if (token.text === "null") {
        return {
          kind: "literal",
          value: null,
          valueType: { kind: "null" }
        };
      }
      if (this.current().text === "(") {
        this.consume();
        const argumentsList: Expression[] = [];
        if (this.current().text !== ")") {
          while (true) {
            argumentsList.push(this.parseBinary(1));
            if (this.current().text !== ",") break;
            this.consume();
          }
        }
        if (this.consume().text !== ")") {
          throw new TypedExpressionError(
            "X020",
            `Expected closing parenthesis for function "${token.text}".`
          );
        }
        return { kind: "call", name: token.text, arguments: argumentsList };
      }
      return { kind: "variable", name: token.text };
    }
    if (token.text === "(") {
      const expression = this.parseBinary(1);
      if (this.consume().text !== ")") {
        throw new TypedExpressionError("X020", "Expected closing parenthesis.");
      }
      return expression;
    }
    throw new TypedExpressionError(
      "X020",
      `Expected an expression at position ${token.position + 1}.`
    );
  }
}

export function parseExpression(source: string): Expression {
  return new Parser(tokenize(source)).parse();
}

export type TypeEnvironment = Record<string, ValueType>;
export type ValueEnvironment = Record<string, TypedValue>;
export interface FunctionSignature {
  parameters: ValueType[];
  returns: ValueType;
}
export type FunctionTypeEnvironment = Record<string, FunctionSignature>;
export interface FunctionRuntime {
  parameters: string[];
  body: Expression;
}
export type FunctionValueEnvironment = Record<string, FunctionRuntime>;

export function typeEquals(left: ValueType, right: ValueType): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "money" && right.kind === "money") {
    return left.currency === right.currency;
  }
  if (left.kind === "enum" && right.kind === "enum") {
    return left.name === right.name;
  }
  if (left.kind === "optional" && right.kind === "optional") {
    return typeEquals(left.value, right.value);
  }
  return true;
}

function numeric(type: ValueType): boolean {
  return type.kind === "integer" || type.kind === "decimal";
}

export function inferExpressionType(
  expression: Expression,
  environment: TypeEnvironment,
  functions: FunctionTypeEnvironment = {}
): ValueType {
  if (expression.kind === "literal") return expression.valueType;
  if (expression.kind === "variable") {
    const type = environment[expression.name];
    if (!type) {
      throw new TypedExpressionError(
        "X021",
        `Variable "${expression.name}" is not declared.`
      );
    }
    return type;
  }
  if (expression.kind === "call") {
    const signature = functions[expression.name];
    if (!signature) {
      throw new TypedExpressionError(
        "X027",
        `Function "${expression.name}" is not declared.`
      );
    }
    if (signature.parameters.length !== expression.arguments.length) {
      throw new TypedExpressionError(
        "X028",
        `Function "${expression.name}" expects ${signature.parameters.length} arguments, not ${expression.arguments.length}.`
      );
    }
    expression.arguments.forEach((argument, index) => {
      const actual = inferExpressionType(argument, environment, functions);
      const expected = signature.parameters[index]!;
      if (!typeEquals(actual, expected)) {
        throw new TypedExpressionError(
          "X028",
          `Argument ${index + 1} of "${expression.name}" requires ${expected.kind}, not ${actual.kind}.`
        );
      }
    });
    return signature.returns;
  }
  if (expression.kind === "unary") {
    const operand = inferExpressionType(expression.operand, environment, functions);
    if (expression.operator === "not" && operand.kind === "boolean") {
      return { kind: "boolean" };
    }
    if (expression.operator === "-" && numeric(operand)) return operand;
    throw new TypedExpressionError(
      "X022",
      `Operator ${expression.operator} does not accept ${operand.kind}.`
    );
  }

  const left = inferExpressionType(expression.left, environment, functions);
  const right = inferExpressionType(expression.right, environment, functions);
  if (expression.operator === "??") {
    if (left.kind !== "optional") {
      throw new TypedExpressionError(
        "X023",
        "The left operand of ?? must be optional."
      );
    }
    if (!typeEquals(left.value, right)) {
      throw new TypedExpressionError(
        "X023",
        `Coalescing ${left.value.kind} requires the same fallback type, not ${right.kind}.`
      );
    }
    return left.value;
  }
  if (expression.operator === "and" || expression.operator === "or") {
    if (left.kind === "boolean" && right.kind === "boolean") {
      return { kind: "boolean" };
    }
    throw new TypedExpressionError(
      "X022",
      `Boolean operator ${expression.operator} requires boolean operands.`
    );
  }
  if (["=", "!=", "<", "<=", ">", ">="].includes(expression.operator)) {
    if (!typeEquals(left, right)) {
      throw new TypedExpressionError(
        "X024",
        `Cannot compare ${left.kind} with ${right.kind}.`
      );
    }
    return { kind: "boolean" };
  }
  if (numeric(left) && numeric(right)) {
    if (
      expression.operator === "/" ||
      left.kind === "decimal" ||
      right.kind === "decimal"
    ) {
      return {
        kind: "decimal",
        scale:
          (left.kind === "decimal" ? left.scale : 0) +
          (right.kind === "decimal" ? right.scale : 0)
      };
    }
    return { kind: "integer" };
  }
  if (left.kind === "money" && right.kind === "money") {
    if (
      left.currency === right.currency &&
      (expression.operator === "+" || expression.operator === "-")
    ) {
      return {
        kind: "money",
        currency: left.currency,
        scale: Math.max(left.scale, right.scale)
      };
    }
  }
  if (
    left.kind === "money" &&
    numeric(right) &&
    (expression.operator === "*" || expression.operator === "/")
  ) {
    return left;
  }
  if (expression.operator === "+" && left.kind === "text" && right.kind === "text") {
    return { kind: "text" };
  }
  throw new TypedExpressionError(
    "X022",
    `Operator ${expression.operator} does not accept ${left.kind} and ${right.kind}.`
  );
}

function asDecimal(value: TypedValue): DecimalValue {
  if (typeof value === "bigint") {
    return { kind: "decimal", coefficient: value, scale: 0 };
  }
  if (typeof value === "object" && value?.kind === "decimal") return value;
  throw new TypedExpressionError("X025", "Expected a numeric value.");
}

function comparison(value: number, operator: string): boolean {
  if (operator === "=") return value === 0;
  if (operator === "!=") return value !== 0;
  if (operator === "<") return value < 0;
  if (operator === "<=") return value <= 0;
  if (operator === ">") return value > 0;
  return value >= 0;
}

function compareValues(left: TypedValue, right: TypedValue): number {
  if (typeof left === "bigint" && typeof right === "bigint") {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (
    typeof left === "object" &&
    left?.kind === "decimal" &&
    typeof right === "object" &&
    right?.kind === "decimal"
  ) {
    return compareDecimal(left, right);
  }
  if (
    typeof left === "object" &&
    left?.kind === "money" &&
    typeof right === "object" &&
    right?.kind === "money"
  ) {
    return compareMoney(left, right);
  }
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right, "en");
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }
  if (left === null && right === null) return 0;
  if (
    typeof left === "object" &&
    left !== null &&
    typeof right === "object" &&
    right !== null &&
    "kind" in left &&
    "kind" in right &&
    left.kind === right.kind
  ) {
    const leftComparable =
      left.kind === "datetime"
        ? left.epochMilliseconds
        : left.kind === "enum"
          ? `${left.enumName}.${left.member}`
          : "value" in left
            ? left.value
            : undefined;
    const rightComparable =
      right.kind === "datetime"
        ? right.epochMilliseconds
        : right.kind === "enum"
          ? `${right.enumName}.${right.member}`
          : "value" in right
            ? right.value
            : undefined;
    if (
      (typeof leftComparable === "string" &&
        typeof rightComparable === "string") ||
      (typeof leftComparable === "number" &&
        typeof rightComparable === "number")
    ) {
      return leftComparable < rightComparable
        ? -1
        : leftComparable > rightComparable
          ? 1
          : 0;
    }
  }
  throw new TypedExpressionError("X025", "Values are not comparable.");
}

export function evaluateExpression(
  expression: Expression,
  types: TypeEnvironment,
  values: ValueEnvironment,
  functionTypes: FunctionTypeEnvironment = {},
  functions: FunctionValueEnvironment = {},
  callStack: string[] = []
): TypedValue {
  inferExpressionType(expression, types, functionTypes);
  if (expression.kind === "literal") return expression.value;
  if (expression.kind === "variable") {
    if (!Object.hasOwn(values, expression.name)) {
      throw new TypedExpressionError(
        "X026",
        `Variable "${expression.name}" has no runtime value.`
      );
    }
    return values[expression.name]!;
  }
  if (expression.kind === "call") {
    const runtime = functions[expression.name];
    if (!runtime) {
      throw new TypedExpressionError(
        "X027",
        `Function "${expression.name}" has no runtime body.`
      );
    }
    if (callStack.includes(expression.name)) {
      throw new TypedExpressionError(
        "X029",
        `Recursive call cycle: ${[...callStack, expression.name].join(" -> ")}.`
      );
    }
    const argumentValues = expression.arguments.map((argument) =>
      evaluateExpression(
        argument,
        types,
        values,
        functionTypes,
        functions,
        callStack
      )
    );
    const signature = functionTypes[expression.name]!;
    const localTypes: TypeEnvironment = { ...types };
    const localValues: ValueEnvironment = { ...values };
    runtime.parameters.forEach((parameter, index) => {
      localTypes[parameter] = signature.parameters[index]!;
      localValues[parameter] = argumentValues[index]!;
    });
    return evaluateExpression(
      runtime.body,
      localTypes,
      localValues,
      functionTypes,
      functions,
      [...callStack, expression.name]
    );
  }
  if (expression.kind === "unary") {
    const value = evaluateExpression(
      expression.operand,
      types,
      values,
      functionTypes,
      functions,
      callStack
    );
    if (expression.operator === "not") return !value;
    if (typeof value === "bigint") return -value;
    const decimal = asDecimal(value);
    return { ...decimal, coefficient: -decimal.coefficient };
  }
  if (expression.operator === "and") {
    const left = evaluateExpression(expression.left, types, values, functionTypes, functions, callStack);
    return left
      ? evaluateExpression(expression.right, types, values, functionTypes, functions, callStack)
      : false;
  }
  if (expression.operator === "or") {
    const left = evaluateExpression(expression.left, types, values, functionTypes, functions, callStack);
    return left
      ? true
      : evaluateExpression(expression.right, types, values, functionTypes, functions, callStack);
  }
  const left = evaluateExpression(expression.left, types, values, functionTypes, functions, callStack);
  if (expression.operator === "??") {
    return left === null
      ? evaluateExpression(expression.right, types, values, functionTypes, functions, callStack)
      : left;
  }
  const right = evaluateExpression(expression.right, types, values, functionTypes, functions, callStack);
  if (["=", "!=", "<", "<=", ">", ">="].includes(expression.operator)) {
    return comparison(compareValues(left, right), expression.operator);
  }
  if (typeof left === "bigint" && typeof right === "bigint") {
    if (expression.operator === "+") return left + right;
    if (expression.operator === "-") return left - right;
    if (expression.operator === "*") return left * right;
    return divideDecimal(asDecimal(left), asDecimal(right));
  }
  if (
    typeof left === "object" &&
    left?.kind === "money" &&
    typeof right === "object" &&
    right?.kind === "money"
  ) {
    return expression.operator === "+"
      ? addMoney(left, right)
      : subtractMoney(left, right);
  }
  if (typeof left === "object" && left?.kind === "money") {
    const factor = asDecimal(right);
    return {
      kind: "money",
      currency: left.currency,
      amount:
        expression.operator === "*"
          ? multiplyDecimal(left.amount, factor)
          : divideDecimal(left.amount, factor)
    } satisfies MoneyValue;
  }
  if (typeof left === "string" && typeof right === "string") {
    return left + right;
  }
  const a = asDecimal(left);
  const b = asDecimal(right);
  if (expression.operator === "+") return addDecimal(a, b);
  if (expression.operator === "-") return subtractDecimal(a, b);
  if (expression.operator === "*") return multiplyDecimal(a, b);
  return divideDecimal(a, b);
}
