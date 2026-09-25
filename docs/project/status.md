# Project status and limitations

IntentLang is currently `v0.8.0-alpha.0`. It is an experimental controlled-
English language and application generator, not a production platform or an
arbitrary-English coding system.

## Current evidence

- 744 automated tests pass.
- All 39 conformance fixtures pass.
- All 97 stable language inventory entries link to normative rules and evidence.
- CI runs 5,000 deterministic adversarial programs.
- Canonical and semantic fingerprints detect unintended drift.
- Compatibility gates classify source, dependency, generator, and artifact
  changes.
- Trace maps connect source to IR, schema, routes, UI, authorization, audit, and
  tests.
- Language changes require proposals, specifications, registry changes,
  compatibility evidence, traces, tests, and documentation.

The full internal assurance plan is complete except for activities that require
people outside the implementation team:

- a real comprehension pilot across representative cohorts;
- publication of its positive, negative, and null findings;
- an independent security and specification review.

The repository contains the study protocol, counterbalanced tasks, anonymized
result schema, analysis implementation, review brief, and report template.
No participant findings or external sign-off are claimed.

## Important limitations

- The grammar is finite; normal unrestricted English is not accepted.
- Generated applications are not production-ready.
- No OAuth, MFA, password reset, or email verification.
- No finalized safe delete/archive workflow.
- SQLite is the generated database; PostgreSQL is not implemented.
- Rate limiting assumes one process and stores state in memory.
- No distributed runtime or cloud deployment architecture is provided.
- Generated applications bind to localhost by default.
- Security controls have not received independent review.
- Visual/page support is a safe subset, not complete HTML, CSS, or JavaScript.
- Custom browser scripts, embedded documents, SVG/MathML, and arbitrary event
  handlers are not part of the visual language.

## Safety model

IntentLang uses explicit, default-deny permissions. Generated runtimes enforce
ownership and self scopes, hidden-not-found behavior for unauthorized records,
CSRF and same-origin checks, idempotency, optimistic concurrency, transaction
boundaries, password/session/CSRF hashing, and audit redaction.

The compiler rejects invalid grammar, conflicting declarations, incomplete
workflow actions, incompatible types, unsafe external contracts, unbounded
retries, unresolved secrets, and unacknowledged destructive generation plans.

These controls reduce risk; they do not replace deployment hardening,
operations, penetration testing, or independent review. See the
[security policy](../../SECURITY.md).

## Release position

The current alpha is appropriate for:

- evaluating controlled-English programming;
- experimenting with deterministic application generation;
- inspecting formal language assurance;
- contributing grammar, tooling, tests, and examples.

It is not appropriate for production systems or sensitive data.
