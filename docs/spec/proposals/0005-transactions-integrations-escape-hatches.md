# Proposal 0005: Transactions, Integrations, and Escape Hatches

**Status**: Experimental implementation

## Problem

Serious applications must update multiple records, call external systems, and
occasionally use capabilities outside the closed language. Partial writes,
unbounded retries, embedded secrets, or unrestricted custom code would break
IntentLang's deterministic and security guarantees.

## Transaction contract

A transaction has a stable name, an idempotency key, a request fingerprint,
and ordered steps. Writes become visible only after every step succeeds.
Failure restores the exact prior state. Reusing an idempotency key with the same
fingerprint replays the recorded outcome; reusing it for different input fails.

## External contract

An integration declares its HTTPS endpoint, operations, request and response
fields, timeout, retry policy, idempotency behavior, and named secret
references. Retry decisions are finite and explicit. Secret values are resolved
only at execution and cannot appear in source, diagnostics, traces, or audit
metadata.

## Escape-hatch contract

An escape hatch declares required capabilities and the guarantees it excludes.
Execution requires an explicit capability grant, an isolated executor, a
timeout, and an audit record. Source is represented by a fingerprint in audit
metadata; raw code and secret values are not logged.

## Compatibility

These are additive experimental runtime semantics. Existing applications and
generated behavior are unchanged until they explicitly adopt these contracts.
