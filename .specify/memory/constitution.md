# IntentLang Language Constitution

## Purpose

IntentLang exists to turn confirmed human intent into deterministic,
inspectable, secure software. Its defining promise is not unrestricted natural
language understanding. Its promise is that every accepted program has one
explicit meaning, all required context is recorded, and every generated behavior
can be traced back to reviewed source.

The project competes on correctness, explainability, application-level
abstraction, and whole-system generation. Feature count alone MUST NOT override
these guarantees.

## Core Principles

### I. No Unresolved Ambiguity

An accepted program MUST have exactly one specified interpretation. When input
has multiple plausible meanings, the system MUST do one of the following:

1. present a finite set of explicit interpretations;
2. request the missing decision through structured clarification; or
3. reject the input with an actionable diagnostic.

The compiler MUST NOT silently guess. Ambiguity findings and user choices MUST
be representable in durable canonical source or explicit configuration.

### II. Context Closure

Every accepted program MUST contain all context required for compilation and
execution. Meaning MUST NOT depend on conversational history, hidden AI memory,
personal convention, undeclared defaults, or generated-code inference.

Names, types, relationships, ownership, state transitions, permissions,
security-sensitive defaults, imports, and external capabilities MUST resolve
explicitly. Undeclared, conflicting, or non-unique references MUST be rejected.

### III. Normative, Versioned Semantics

Every accepted construct MUST be defined by a versioned normative language
specification with:

- syntax and lexical rules;
- typed semantics;
- name-resolution rules;
- evaluation order;
- error behavior;
- canonical form;
- runtime and security obligations; and
- compatibility classification.

The implementation MUST NOT be the sole specification. Every normative rule
MUST have a stable identifier.

### IV. Canonical Meaning

Friendly aliases MAY be accepted only when deliberately registered. Each alias
MUST normalize immediately to the same typed representation and one canonical
printed form. Formatting canonical source MUST be idempotent.

One semantic operation MUST NOT have multiple durable representations whose
behavior can diverge. Canonicalization MUST preserve comments or rationale
where the language explicitly supports them.

### V. Deterministic, Reproducible Compilation

Given the same canonical source, declared configuration, dependency lock,
language version, and compiler version, IntentLang MUST produce the same
semantic model and deterministic artifacts.

Manifests MUST record language, IR, compiler, generator, dependency, source,
and semantic fingerprints. Non-deterministic values required at runtime MUST be
generated at runtime, never hidden in compilation.

### VI. Cross-Layer Semantic Equivalence

A source requirement MUST have consistent meaning in every generated layer:

- typed IR;
- browser UI;
- backend/API;
- database/schema/query behavior;
- authorization;
- audit behavior;
- tests; and
- documentation.

Security and workflow rules MUST be enforced at the authoritative backend and
database boundaries even when reflected in the UI. No generator MAY implement
a weaker interpretation than the normative rule.

### VII. Security by Construction

Authentication, authorization, ownership, validation, workflow preconditions,
origin/CSRF protection, idempotency, concurrency, audit safety, and sensitive
data handling MUST be explicit compiler concerns rather than optional
application conventions.

Authorization MUST be default-deny. Security-relevant shorthand MUST have a
reviewable expanded form. Unsupported security requirements MUST fail closed.

### VIII. Concise but Inspectable Abstraction

IntentLang MUST reduce repetition through formal abstractions—not implicit
magic or increasingly verbose prose. Role inheritance, named policies, reusable
field groups, workflow patterns, modules, procedures, queries, and mathematical
notation MAY be added only with exact expansion and semantics.

Studio and tooling MUST be able to display the expanded permissions, states,
effects, and generated obligations behind every shorthand. Conciseness MUST
never hide authority or side effects.

### IX. Modular, Scalable Composition

Large applications MUST support explicit modules, imports, exports, namespaces,
dependency versions, and deterministic compilation order. Circular dependencies
and conflicting exports MUST produce clear diagnostics.

Splitting or combining modules without semantic changes MUST preserve the same
semantic fingerprint. Diagnostics and traceability MUST retain original file
and source locations.

### X. Compatibility Without Silent Meaning Changes

Language, IR, and generator versions MUST follow published compatibility rules:

- patch releases MUST NOT alter accepted-program semantics;
- minor releases MAY add backward-compatible constructs;
- major releases are required for incompatible semantics.

Historical examples and conformance fixtures MUST be recompiled in CI. Any
change to IR, permissions, routes, workflows, schema, or canonical source MUST
be reviewed as a semantic compatibility event.

### XI. Conformance and Adversarial Proof

Every normative rule MUST map to positive, negative, ambiguity,
canonicalization, and runtime tests where applicable. The project MUST maintain:

- an official conformance suite;
- an ambiguity corpus;
- parser and formatter property tests;
- fuzzing and resource-limit tests;
- authorization-matrix tests;
- cross-backend or cross-generator parity tests where multiple implementations
  exist; and
- historical compatibility fixtures.

Examples demonstrate value but MUST NOT substitute for conformance evidence.

### XII. Evidence of Human Comprehension

Readability claims MUST be validated with representative users, including
domain experts, developers, security reviewers, and beginners. Studies MUST
measure correct interpretation, safe modification, time-to-understanding,
retention, introduced defects, and false confidence.

When conventional mathematical, query, tabular, state-machine, or visual
notation is clearer than prose, IntentLang SHOULD use that notation rather than
forcing English sentences.

### XIII. Governed Expressiveness

IntentLang SHOULD become feature-rich enough for serious applications,
including typed expressions, collections, functions, queries, state machines,
transactions, modules, integrations, packages, and explicit escape hatches.

Every addition MUST preserve the other principles. Escape hatches MUST be
clearly marked, permissioned, sandboxed or isolated where practical, and excluded
from guarantees they bypass. The language MUST be correct-or-loud rather than
silently incomplete.

### XIV. Reviewed Intent Resolution

IntentLang MAY accept broader natural-language requirements through an
intent-resolution layer. That layer MUST:

1. identify missing context and ambiguity;
2. ask structured, security-aware clarification questions;
3. show the exact canonical interpretation;
4. explain generated data, workflow, permission, and side-effect semantics;
5. require confirmation before durable source changes; and
6. submit canonical source to the deterministic compiler.

AI-generated or heuristic proposals MUST have no execution authority until they
pass deterministic validation and explicit review.

## Mandatory Feature Proposal Contract

Every new language construct or semantic change MUST include:

1. problem statement and user scenario;
2. normative rule identifiers;
3. grammar and canonical form;
4. typed semantic model or IR changes;
5. ambiguity and context analysis;
6. interaction with existing constructs;
7. security and privacy effects;
8. compatibility and migration classification;
9. diagnostics and recovery behavior;
10. generator/runtime obligations;
11. positive, negative, canonical, property, and runtime tests;
12. documentation and examples;
13. traceability evidence; and
14. measurable effect on readability, conciseness, or capability.

Parser-only, generator-only, documentation-only, or untested language additions
MUST NOT be accepted as complete.

## Quality Gates

Before implementation begins, a feature plan MUST pass a Constitution Check
covering all applicable principles.

Before merge, a language-affecting change MUST demonstrate:

- normative specification updates;
- conformance-test coverage;
- canonical formatting behavior;
- deterministic semantic fingerprints;
- backward-compatibility analysis;
- cross-layer tests for security/workflow behavior;
- complete diagnostics for invalid and ambiguous cases;
- updated traceability metadata;
- documentation and runnable examples; and
- no regression in existing unit, browser, end-to-end, fuzz, or compatibility
  suites.

If a gate is temporarily impossible, the feature MUST remain experimental,
disabled by default, explicitly excluded from stable guarantees, and tracked by
a dated remediation issue. Security and semantic-correctness gates cannot be
waived.

## Competitive Standard

IntentLang MUST study mature language projects and meet or exceed established
engineering standards for parsers, type systems, tooling, packaging, testing,
documentation, and release discipline.

Its unique advantage MUST remain:

- intent clarification before execution;
- application-level semantics;
- security by construction;
- cross-layer traceability;
- deterministic whole-application generation; and
- explainable mapping from requirement to running behavior.

The project MUST NOT pursue a feature solely to match a competitor. Each feature
MUST strengthen a user outcome or one of the constitutional guarantees.

## Governance

This constitution supersedes feature-roadmap pressure, marketing claims, and
implementation convenience.

Amendments require:

1. a written rationale;
2. impact analysis against all fourteen principles;
3. migration implications;
4. updated acceptance gates; and
5. explicit maintainer approval.

Constitution amendments use semantic versioning:

- **MAJOR**: removes or weakens a principle or mandatory gate;
- **MINOR**: adds a principle, gate, or materially stronger obligation;
- **PATCH**: clarification without changing obligations.

All specifications, plans, tasks, pull requests, and release reviews MUST verify
constitutional compliance. A feature is not complete until its evidence is
durable in the repository and independently reproducible.

**Version**: 1.0.0 | **Ratified**: 2026-09-25 | **Last Amended**: 2026-09-25
