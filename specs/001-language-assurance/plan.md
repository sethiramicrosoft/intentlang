# Implementation Plan: IntentLang Language Assurance and Expansion

**Branch**: `001-language-assurance` | **Date**: 2026-09-25 | **Spec**: [spec.md](spec.md)

## Summary

Deliver a multi-phase language program that addresses all fourteen English
programming concerns as enforceable guarantees, then expands IntentLang into a
feature-rich language without weakening those guarantees.

The architecture adds:

1. a normative specification and rule registry;
2. conformance, ambiguity, property, compatibility, and traceability suites;
3. canonicalization and semantic fingerprints;
4. inspectable abstractions and modules;
5. reviewed intent resolution;
6. typed expressions, queries, workflows, transactions, integrations, packages,
   and controlled escape hatches; and
7. mature tooling and empirical usability evidence.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 24; generated JavaScript,
Node.js ESM, SQLite SQL, HTML and CSS

**Primary Dependencies**: Existing zero-framework compiler/runtime;
`parse5`, `css-tree`, `@vscode/web-custom-data`, Playwright; proposed
property-based testing dependency only after design approval

**Storage**: Repository fixtures and JSON/YAML rule data; generated SQLite
applications; optional local study-result datasets with anonymized aggregates

**Testing**: Node test runner through `tsx`; Playwright browser tests; generated
runtime end-to-end tests; future property/fuzz harness

**Target Platform**: Windows, Linux, and macOS development; Node.js local
runtime; current generated browser applications

**Project Type**: Compiler, language tooling, Studio web IDE, code generators,
generated application runtime

**Performance Goals**:

- Preserve current source/element limits and explicit resource failures.
- Canonical formatting and semantic fingerprinting add less than 15% to current
  check time for 10,000-line programs.
- Intent clarification returns deterministic offline analysis in under 500 ms
  for 95% of supported requirement documents under 50 KB.
- Module graph resolution scales to 1,000 modules without non-linear repeated
  parsing.

**Constraints**:

- Offline deterministic compilation remains the default.
- AI proposals never gain execution authority.
- Existing source compatibility is preserved until a major language version.
- Generated security remains default-deny and backend-enforced.
- No language feature is stable without normative and conformance evidence.

**Scale/Scope**:

- Stable rule registry covering all current business-app and visual/page grammar.
- Historical fixtures for every released example.
- Reference applications including LaunchOps and at least three computation,
  query, integration, and transaction-heavy systems.
- Multi-year program delivered as independently valuable phases.

## Constitution Check

### Pre-design gates

| Principle | Plan response | Status |
|---|---|---|
| I. No unresolved ambiguity | Add ambiguity corpus, clarification results, and reject/choose/clarify outcome contract | PASS |
| II. Context closure | Add context-closure analysis and self-contained canonical program model | PASS |
| III. Normative semantics | Rule registry and versioned normative specification are Phase 1 | PASS |
| IV. Canonical meaning | Canonical AST/source and alias registry precede new aliases | PASS |
| V. Determinism | Semantic fingerprints and deterministic fixture comparison are Phase 2 | PASS |
| VI. Cross-layer equivalence | Trace graph and layer conformance are Phase 3 | PASS |
| VII. Security by construction | Authorization matrices and expanded policies remain mandatory | PASS |
| VIII. Concise abstraction | Role inheritance/policies are added only with exact expansion | PASS |
| IX. Modular composition | Module graph includes explicit imports/exports and deterministic order | PASS |
| X. Compatibility | Historical compatibility gates precede stable new semantics | PASS |
| XI. Adversarial proof | Property, fuzz, matrix, invariant and resource tests are planned | PASS |
| XII. Human evidence | Repeatable study protocol and anonymized metrics are planned | PASS |
| XIII. Governed expressiveness | New features enter through proposal contract and correct-or-loud generators | PASS |
| XIV. Reviewed intent resolution | Clarification and canonical review are separate from compiler authority | PASS |

### Post-design re-check

Must be repeated for every phase and every individual language proposal. No
phase may introduce stable syntax before its normative and conformance
infrastructure is operational.

## Architecture Decisions

### AD-001: Normative rules are repository data

Create a machine-readable rule registry backed by human-readable normative
documents. Each stable construct receives a permanent identifier and references
grammar, semantic model, diagnostics, canonical form, obligations, tests, and
compatibility status.

### AD-002: Canonical source remains the executable authority

Natural requirements and AI proposals are inputs to intent resolution, not
programs. Only reviewed canonical source is accepted by the deterministic
compiler.

### AD-003: Semantic fingerprints derive from normalized IR

Separate source, semantic, and artifact fingerprints. The semantic fingerprint
is calculated from canonical, order-aware IR with non-semantic metadata removed.

### AD-004: Abstractions expand before authorization and generation

Role inheritance, policies, reusable workflows, and field groups expand into a
fully explicit typed model. Security checks and generators consume the expanded
model, preventing hidden shorthand behavior.

### AD-005: Modules compose into one canonical application graph

Modules parse independently, resolve through explicit imports/exports, and
produce one application-level symbol graph. Source locations survive expansion.

### AD-006: Traceability is a compiler output

Trace links are generated during parsing, resolution, expansion, validation, and
generation—not reconstructed from text afterward.

### AD-007: Correct-or-loud applies to every backend

A generator declares the normative capabilities it supports. It must reject
unsupported semantic nodes rather than omit, approximate, or weaken them.

### AD-008: Feature breadth follows proof maturity

Typed expressions and general computation begin only after semantic
fingerprinting, conformance, and compatibility gates exist. This prevents
unverifiable growth.

## Delivery Phases

### Phase 0 — Inventory and Baseline

- Inventory every accepted grammar form, diagnostic, IR node, and generator
  obligation.
- Assign provisional normative rule IDs.
- Capture current canonical outputs and historical example baselines.
- Measure current compilation performance and LaunchOps repetition metrics.
- Produce gap matrix against the fourteen constitutional principles.

**Exit gate**: 100% of current stable constructs appear in the inventory.

### Phase 1 — Normative Specification and Conformance Core

- Publish lexical, grammar, resolution, type, action, permission, page-runtime,
  diagnostic, canonicalization, and compatibility chapters.
- Implement rule registry validation.
- Establish `conformance/valid`, `invalid`, `ambiguous`, `canonical`, `runtime`,
  and `compatibility`.
- Add rule-to-test coverage reporting.

**Exit gate**: No current stable construct lacks a rule ID and baseline fixture.

### Phase 2 — Canonicalization and Semantic Compatibility

- Make canonical formatting explicitly versioned and idempotent.
- Add source, semantic, IR, generator, dependency, and artifact fingerprints.
- Add historical recompilation and semantic-diff tooling.
- Define release compatibility policy and migration report format.

**Exit gate**: Injected semantic changes are caught reliably by CI.

### Phase 3 — Traceability and Cross-Layer Proof

- Add source spans and rule IDs to IR nodes.
- Generate trace maps for schema, routes, UI controls, authorization decisions,
  audit operations, and tests.
- Add trace explorer to Studio.
- Add representative cross-layer conformance tests.

**Exit gate**: LaunchOps security/workflow rules are traceable end to end.

### Phase 4 — Adversarial Assurance

- Add parser/formatter property harness.
- Add fuzz corpus and resource-limit runner.
- Generate authorization matrices from expanded policies.
- Add workflow invariant and idempotency model tests.
- Add migration and naming-collision adversarial tests.

**Exit gate**: Published properties pass required case counts on all supported OSes.

### Phase 5 — Concise Security and Workflow Abstractions

- Add role inheritance.
- Add named policy bundles and entity sets.
- Add reusable field groups and workflow/state-machine declarations.
- Add expanded-policy/workflow inspection in Studio.
- Rewrite LaunchOps and prove semantic equivalence.

**Exit gate**: At least 60% reduction in LaunchOps boilerplate with equivalent
expanded semantics.

### Phase 6 — Modules, Imports, Namespaces and Packages

- Add module declarations, exports, imports, aliases, namespaces, and graph
  resolution.
- Add lockfile/version requirements and package integrity metadata.
- Preserve source-located diagnostics and traceability.
- Split LaunchOps into modules with equivalent semantic fingerprint.

**Exit gate**: Modular and single-file LaunchOps are semantically equivalent.

### Phase 7 — Intent Resolution and Clarification

- Add requirement concept extraction and context model.
- Add deterministic clarification rules for security, ownership, workflows,
  types, defaults, failure behavior, and unsupported capabilities.
- Add proposal review showing canonical diff and exact semantic explanation.
- Add confirmation records and conflict handling.
- Keep optional AI behind the same proposal contract.

**Exit gate**: Ambiguity corpus has zero silent guesses and confirmed proposals
are context-closed.

### Phase 8 — Typed Computation and Data Language

- Add typed expressions and numeric semantics.
- Add functions/procedures with effects and purity metadata.
- Add collections, records, enums, dates, time, money, and validation types.
- Add query/filter/sort/group/aggregate language with authorization-aware plans.

**Exit gate**: Reference analytics and pricing applications compile with
specified deterministic results.

### Phase 9 — State Machines, Transactions and Integrations

- Promote workflows to explicit state machines and invariants.
- Add multi-record transactions and rollback semantics.
- Add external service contracts, retries, timeouts, idempotency, and secrets
  references.
- Add capability-scoped, auditable escape hatches.

**Exit gate**: Reference integration application survives failure injection
without partial effects or secret leakage.

### Phase 10 — Tooling and Independent Validation

- Build full LSP: symbols, references, rename, completion, hover, code actions,
  semantic tokens, module navigation, and trace navigation.
- Add REPL/evaluator for typed expressions and queries.
- Add debugger for workflows, policy decisions, and generated requests.
- Publish conformance runner and independent validator interfaces.

**Exit gate**: External tools can validate stable core behavior without importing
private compiler internals.

### Phase 11 — Human Evidence and Stable Release

- Run comprehension and safe-change studies.
- Publish results, including false confidence and negative findings.
- Complete independent security review.
- Ratify stable language/IR compatibility policy.
- Graduate only proven features from experimental status.

**Exit gate**: Stable release claims are evidence-backed and independently
reproducible.

## Project Structure

```text
.specify/
├── memory/constitution.md
└── templates/

specs/001-language-assurance/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── rule-registry.schema.json
│   ├── semantic-manifest.schema.json
│   ├── trace-map.schema.json
│   └── intent-proposal.schema.json
└── tasks.md

docs/spec/
├── index.md
├── lexical.md
├── grammar.md
├── resolution.md
├── types.md
├── actions.md
├── authorization.md
├── canonicalization.md
├── diagnostics.md
└── compatibility.md

language/
├── rules/
├── aliases/
└── versions/

conformance/
├── valid/
├── invalid/
├── ambiguous/
├── canonical/
├── runtime/
└── compatibility/

src/
├── parser.ts
├── compiler.ts
├── formatter.ts
├── model.ts
├── manifest.ts
├── planner.ts
├── runtime-codegen.ts
├── ui-codegen.ts
├── studio-server.ts
├── studio-assets.ts
├── language/
│   ├── rule-registry.ts
│   ├── canonical.ts
│   ├── semantic-fingerprint.ts
│   ├── compatibility.ts
│   ├── trace.ts
│   ├── modules.ts
│   ├── policies.ts
│   └── intent-resolution.ts
└── tooling/
    ├── lsp/
    ├── repl/
    └── debugger/

test/
├── conformance.test.ts
├── compatibility.test.ts
├── traceability.test.ts
├── properties.test.ts
├── authorization-matrix.test.ts
├── workflow-invariants.test.ts
└── intent-resolution.test.ts
```

**Structure Decision**: Extend the current single TypeScript compiler project.
Keep normative data, conformance fixtures, and product specifications separate
from implementation code. Introduce subdirectories only when a phase needs
them; do not migrate unrelated files preemptively.

## Risk Management

| Risk | Mitigation |
|---|---|
| Specification diverges from implementation | Machine-readable rule registry and rule-to-test coverage gate |
| Feature breadth delays foundational work | Phase exits prohibit stable syntax before proof infrastructure |
| Abstractions hide security behavior | Mandatory expansion model and Studio inspector |
| Modules destabilize diagnostics | Preserve source spans and add equivalence fixtures |
| AI introduces non-determinism | Proposal-only authority; canonical confirmation required |
| Semantic fingerprints are too sensitive | Define normalized semantic model and separate artifact fingerprints |
| Compatibility freezes defects | Major-version process plus explicit migration tooling |
| Fuzzing becomes flaky or unbounded | Seeded deterministic runs, budgets, minimized persisted regressions |
| Usability studies create privacy issues | Consent, anonymization, aggregated repository data only |
| Competitor checklist distracts product | Constitution requires user-outcome justification for every feature |

## Complexity Tracking

| Complexity | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Rule registry plus prose specification | Independent and machine-verifiable semantics | Prose alone cannot enforce coverage; code alone is not independent |
| Separate source/semantic/artifact fingerprints | Differentiate meaning from formatting and generator changes | One hash cannot explain compatibility impact |
| Expansion layer for abstractions | Preserve inspectable authorization/workflow semantics | Direct generator shortcuts would hide security behavior |
| Trace map output | Prove cross-layer equivalence | Post-hoc text search is incomplete and fragile |
| Intent proposal model | Separate flexible input from executable authority | Direct natural-language execution permits ambiguity |
| Multi-phase program | Scope spans language definition, tooling, runtime and evidence | A single large implementation change would be unsafe and unverifiable |

## Plan Review Questions

The plan is intentionally ordered around guarantees before breadth. Review
should confirm:

1. whether the first implementation release should stop after Phase 3 or include
   Phase 5 role/policy abstractions;
2. whether normative rules cover both business-app and visual/page languages in
   the first specification release;
3. whether the stable compatibility promise begins at v1.0 or is introduced as
   an experimental compatibility report before v1.0; and
4. which reference application should accompany LaunchOps for typed
   computation/query work.
