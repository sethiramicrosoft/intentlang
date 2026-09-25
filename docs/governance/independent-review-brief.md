# Independent Security and Specification Review Brief

**Review status: not commissioned. Stable graduation is blocked.**

## Reviewer independence

The lead reviewer must not have authored the reviewed implementation. Record
reviewer organization or independence statement, review dates, commit, tools,
methods, conflicts of interest, and funding.

## Scope

- normative specifications and rule registry;
- parser, canonicalization, type and effect semantics;
- modules, integrity locks, manifests, and compatibility;
- authentication, authorization, ownership, workflows, transactions,
  integrations, secrets, audit, and escape hatches;
- database, runtime, UI, Studio, LSP, and CLI generators/tools;
- conformance, fuzzing, backend parity, traceability, and release process.

## Required questions

1. Can accepted source have more than one plausible runtime meaning?
2. Can a backend omit or weaken a normative security or workflow rule?
3. Can authorization, ownership, idempotency, rollback, or concurrency fail open?
4. Can secrets or sensitive payloads reach diagnostics, logs, traces, manifests,
   generated source, or browser responses?
5. Can modules, locks, manifests, or migrations accept unreviewed semantic drift?
6. Can escape hatches exceed declared capabilities or excluded guarantees?
7. Are conformance and governance gates independently reproducible?

## Deliverables

- methodology and tested commit;
- findings with severity, confidence, evidence, and remediation;
- specification inconsistencies and ambiguous rules;
- residual-risk statement;
- retest results;
- explicit recommendation for or against stable graduation.

Use `independent-review-report-template.md`. Publish the report unless coordinated
vulnerability disclosure requires temporary confidentiality.
