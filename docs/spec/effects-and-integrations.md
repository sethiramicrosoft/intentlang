# Effects and Integrations

## TRANSACTION-001

A transaction executes ordered named steps against a private working state.
Reads observe earlier writes in the same transaction. The runtime commits the
working state atomically only after every step succeeds. Any thrown error,
explicit failure, or injected fault rolls back all writes.

Every transaction invocation requires a non-empty idempotency key and a
deterministic request fingerprint. A completed result is replayed only when
both values match. Key reuse with a different fingerprint fails with `I006`.
Audit records distinguish committed, rolled-back, and replayed outcomes.

## EXTERNAL-CONTRACT-001

An external contract declares a base HTTPS URL and closed operation set.
Operations define method, path, exact request and response fields, timeout,
maximum attempts, retryable statuses, idempotency behavior, and secret
references. Unknown or missing fields fail before transport execution.

Retries are bounded. Non-idempotent operations require an idempotency key before
more than one attempt is permitted. Timeout uses cancellation. Response bodies
are validated before being returned. Transport errors expose contract and
operation names but never secret values.

Secret references are symbolic names. A secret resolver supplies values only to
the transport boundary. Source, plans, audit records, and diagnostics retain the
reference name, never the resolved value.

## CAPABILITY-ESCAPE-001

An escape hatch has a stable name, source fingerprint, required capabilities,
timeout, and explicit excluded guarantees. It executes only when every required
capability is granted and an isolated executor is present.

The host receives a frozen input value and the declared capability list.
Execution is bounded by timeout and always emits an audit record with outcome,
duration, capabilities, source fingerprint, and excluded guarantees. Raw source
and resolved secrets are forbidden in audit metadata.

Escape-hatch results do not receive guarantees listed in `excludedGuarantees`.
All guarantees not explicitly excluded remain host obligations.
