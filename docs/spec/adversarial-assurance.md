# Adversarial Assurance

IntentLang maintains deterministic adversarial suites in addition to example
and unit tests.

## Seeded generation

The parser/formatter harness uses the persisted seeds in
`conformance/invalid/regressions/seeds.txt`. For every generated valid program
it proves:

- compilation succeeds without exceptions;
- canonical formatting recompiles;
- formatting is idempotent; and
- canonical typed IR is unchanged by the round trip.

Malformed Unicode, invalid casing, duplicate names and IDs, oversized inputs,
and unknown statements must fail explicitly without partial success.

`npm run test:adversarial` runs 5,000 generated programs in CI.
`npm run test:adversarial:release` runs 1,000,000 generated programs before a
stable release.

## Authorization matrices

Every role, entity, operation, action, and scope combination is evaluated.
Authenticated programs are default-deny. Self and owner scopes are tested with
matching and non-matching identities. Forced-owner create rules must both allow
creation and report that ownership input is compiler-controlled.

## Workflow invariants

Every LaunchOps action is tested as a transition model. A failed precondition
must leave the record unchanged. A valid transition may change only fields
listed by the action's assignments.

## Runtime mutation properties

Generated mutation paths must expose explicit idempotency replay/conflict
behavior, transactional begin/commit/rollback machinery, optimistic
concurrency failures, precondition failures, and audit logging. Generated
errors must not be represented as successful responses or hidden by empty
catch blocks.

Any newly discovered failure is minimized into a rule-linked fixture under
`conformance/invalid/regressions/` before the implementation is corrected.
