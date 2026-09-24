# Proposal 0004: Typed Computation Foundation

**Status**: Experimental implementation

## Problem

Serious pricing, analytics, scheduling, and decision applications need more
than text, integer, and boolean fields. JavaScript floating point and implicit
coercion are not acceptable language semantics.

## Types

- `integer`: arbitrary-precision signed integer.
- `decimal <scale>`: exact base-10 value with declared maximum scale.
- `money <currency> <scale>`: exact decimal amount and ISO-style uppercase
  currency code.
- `date`: ISO `YYYY-MM-DD`.
- `time`: ISO `HH:MM:SS`.
- `datetime`: ISO date/time with `Z` or an explicit numeric offset.
- `text`, `boolean`.
- `enum <Name>`: one member from a closed declared set.
- `optional <T>`: either `T` or `null`.

## Expression syntax

```intentlang
price + tax
quantity * unitPrice
orderedAt is before cutoff
status is Status.approved
customerName ?? "Unknown"
```

Arithmetic, comparison, boolean, and coalescing operators have fixed precedence.
Evaluation is left to right within one precedence level. There is no implicit
numeric, text, currency, timezone, enum, or null conversion.

## Exactness

Decimals are represented as a signed arbitrary-precision coefficient plus a
base-10 scale. Money uses the same representation plus a currency code.
Addition and subtraction preserve the maximum operand scale. Multiplication
adds scales. Division succeeds only when the exact result terminates within 18
decimal places; otherwise the program must use a future explicit rounding
operation.

Money may be added or compared only within the same currency. Money multiplied
or divided by a dimensionless numeric value remains money. Multiplying money by
money is invalid.

## Errors

Parsing, type checking, and evaluation return explicit stable codes. They never
coerce, produce `NaN`, overflow silently, use the host timezone, or return a
success-shaped fallback.

## Compatibility

This is an additive experimental semantic layer. Existing fields, actions, IR,
runtime generation, and canonical source remain unchanged until typed
declarations are deliberately integrated.

## Functions and procedures

Pure functions use typed parameters, a declared return type, and one
deterministic expression. Calls compose, arguments evaluate left to right, and
the compiler rejects direct or indirect recursion. Procedures are separately
declared effectful operations; they require explicit effects and ordered steps
and cannot be called from pure expressions.

## Collections, records, and matching

Collections are immutable ordered sequences with deterministic `map`, `filter`,
and `fold`. Records are closed values with exactly the declared fields. Enum
matching must cover every member exactly once.

## Authorized queries

Queries use typed filters, explicit joins, stable sorting, grouping, and exact
aggregation. Authorization is not an optional filter: it is applied before all
other query operations and is required for every source. SQL plans use quoted
identifiers and parameter placeholders. Unsupported backend operations fail
rather than falling back to runtime-only behavior.
