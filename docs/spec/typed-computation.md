# Typed Computation

## TYPED-EXPRESSION-001

Typed expressions are parsed into a closed AST, type checked before evaluation,
and evaluated without JavaScript numeric coercion.

Supported foundation operators:

- arithmetic: `+`, `-`, `*`, `/`;
- comparison: `=`, `!=`, `<`, `<=`, `>`, `>=`;
- boolean: `and`, `or`, unary `not`;
- null coalescing: `??`;
- grouping with parentheses.

Operands and results have explicit `ValueType` descriptors. Optional values
must be narrowed by `??` before use in non-null operations. Equality supports
same-type values and null checks. Ordering requires compatible integer,
decimal, money, date, time, or datetime operands.

## EXACT-VALUE-001

`DecimalValue` stores a `bigint` coefficient and non-negative scale. Parsing
normalizes trailing zeros without losing exactness. Formatting never uses
exponential notation.

`MoneyValue` stores an uppercase currency and exact decimal amount. Mixed
currency arithmetic or comparison is an error.

Dates, times, and datetimes are parsed from strict ISO strings. Datetimes
require `Z` or an explicit offset. Calendar validity is checked independently
from host locale and timezone.

All failures are `TypedExpressionError` values with stable `X` diagnostics.

## FUNCTION-PROCEDURE-001

A function is pure, has named typed parameters, a declared return type, and one
expression body. Arguments are evaluated from left to right. The body is type
checked against all function signatures before execution. Direct and indirect
recursion are rejected as call-graph cycles.

A procedure is distinct from a function. It declares one or more effects and
one or more ordered steps. Procedures cannot be called from pure expressions.
Effect execution is outside this experimental foundation; undeclared or empty
effect metadata is rejected rather than treated as a no-op.

## COLLECTION-RECORD-001

Collections are ordered and immutable. `map`, `filter`, and `fold` preserve
source iteration order and return new values. Records are closed: every
declared field must be supplied exactly once and undeclared fields are errors.

Enum matching is exhaustive. Every declared member requires exactly one case;
missing members, extra cases, and invalid runtime members fail explicitly.

## AUTHORIZED-QUERY-001

A query declares a source, optional explicit joins, a typed filter, stable
ordering, grouping, and exact aggregates. Join fields must exist and have
compatible types. Filters must produce booleans. Numeric aggregates accept
only integer, decimal, or money values, and mixed currencies fail.

Authorization is mandatory and precedes user filtering, joins, grouping, and
aggregation in the in-memory evaluator. SQL generation also requires an
authorization predicate for the root and every joined source. Values are
emitted as parameters; they are never interpolated into SQL text. Unsupported
expression forms fail with `X056` instead of receiving a different backend
meaning.
