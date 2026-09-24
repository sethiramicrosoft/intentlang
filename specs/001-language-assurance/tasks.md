# Tasks: IntentLang Language Assurance and Expansion

**Input**: Design documents in `specs/001-language-assurance/`

**Prerequisites**: Constitution, `spec.md`, `plan.md`, `research.md`,
`data-model.md`, `quickstart.md`, and `contracts/`

**Execution rule**: Stable syntax cannot be added before the applicable
normative, conformance, canonicalization, compatibility, and traceability tasks
are complete.

## Phase 1: Assurance Infrastructure

**Goal**: Establish repository structure and validation contracts without
changing current language semantics.

- [x] T001 Create `language/rules/`, `language/versions/`, and all six
  `conformance/` category directories with explanatory READMEs.
- [x] T002 [P] Add TypeScript types for normative rules, fixtures, semantic
  manifests, and trace links in `src/language/contracts.ts`.
- [x] T003 [P] Add contract-loading and validation tests in
  `test/language-contracts.test.ts`.
- [x] T004 Add package scripts for assurance validation and reporting in
  `package.json`.
- [x] T005 Add `docs/spec/index.md` describing normative versus tutorial
  documentation and rule-ID conventions.

**Checkpoint**: Empty assurance infrastructure validates and current tests pass.

---

## Phase 2: Current-Language Inventory

**Goal**: Inventory every current stable business-app and visual/page construct
before defining new syntax.

- [x] T006 [US1] Inventory business-app lexical and grammar constructs in
  `language/versions/0.8-business-inventory.json`.
- [x] T007 [P] [US1] Inventory visual/page constructs in
  `language/versions/0.8-visual-inventory.json`.
- [x] T008 [P] [US1] Inventory current diagnostic codes and meanings in
  `language/versions/0.8-diagnostics-inventory.json`.
- [x] T009 [P] [US1] Inventory current IR node kinds and generator obligations
  in `language/versions/0.8-ir-inventory.json`.
- [x] T010 [US1] Implement inventory validation/reporting in
  `src/language/inventory.ts`.
- [x] T011 [US1] Add inventory completeness tests in
  `test/language-inventory.test.ts`.

**Checkpoint**: Every current accepted construct is represented by an inventory
entry or explicitly classified experimental/internal.

---

## Phase 3: Normative Rule Registry and Conformance Core (US1, P1)

**Goal**: Make current semantics independently identifiable and testable.

**Independent Test**: The assurance report maps every stable inventory entry to
a normative rule and applicable fixtures.

### Tests first

- [x] T012 [P] [US1] Add failing rule-registry schema and uniqueness tests in
  `test/rule-registry.test.ts`.
- [x] T013 [P] [US1] Add failing fixture-loader tests in
  `test/conformance.test.ts`.
- [x] T014 [P] [US1] Add failing rule-to-evidence coverage tests in
  `test/language-coverage.test.ts`.

### Implementation

- [x] T015 [US1] Implement the rule registry loader and validator in
  `src/language/rule-registry.ts`.
- [x] T016 [US1] Implement conformance fixture loading in
  `src/language/conformance.ts`.
- [x] T017 [US1] Implement rule-to-inventory and rule-to-fixture coverage
  reporting in `src/language/coverage.ts`.
- [x] T018 [US1] Create the initial v0.8 business-app normative rules in
  `language/rules/0.8-business.json`.
- [x] T019 [US1] Create the initial v0.8 visual/page normative rules in
  `language/rules/0.8-visual.json`.
- [x] T020 [US1] Add baseline valid, invalid, ambiguous, and canonical fixtures
  under `conformance/`.
- [x] T021 [US1] Add `intentlang assurance report` CLI output showing uncovered
  inventory entries and rules in `src/cli.ts`.
- [x] T022 [US1] Publish normative specification chapters under `docs/spec/`
  linked to rule IDs.

**Checkpoint**: SC-001 baseline achieved for current stable constructs.

---

## Phase 4: Canonicalization and Semantic Fingerprints (US1/US4, P1)

**Goal**: Separate source formatting, semantic meaning, and generated artifacts.

### Tests first

- [x] T023 [P] [US1] Add formatter idempotence property tests in
  `test/canonical-properties.test.ts`.
- [x] T024 [P] [US4] Add semantic-fingerprint stability and sensitivity tests
  in `test/semantic-fingerprint.test.ts`.
- [x] T025 [P] [US4] Add historical fixture comparison tests in
  `test/compatibility.test.ts`.

### Implementation

- [x] T026 [US1] Implement canonical semantic normalization in
  `src/language/canonical.ts`.
- [x] T027 [US4] Implement source, semantic, dependency, generator, and artifact
  fingerprints in `src/language/semantic-fingerprint.ts`.
- [x] T028 [US4] Extend manifests with version/fingerprint fields in
  `src/manifest.ts`.
- [x] T029 [US4] Implement semantic diff and compatibility classification in
  `src/language/compatibility.ts`.
- [x] T030 [US4] Add historical baselines under `conformance/compatibility/`.
- [x] T031 [US4] Add CI/package scripts that fail on unapproved semantic drift.
- [x] T032 [US4] Publish `docs/spec/canonicalization.md` and
  `docs/spec/compatibility.md`.

**Checkpoint**: SC-003, SC-004, and initial SC-005 achieved.

---

## Phase 5: Cross-Layer Traceability (US5, P1)

**Goal**: Trace each rule from source through every generated layer.

### Tests first

- [x] T033 [P] [US5] Add source-span preservation tests in
  `test/traceability.test.ts`.
- [x] T034 [P] [US5] Add LaunchOps authorization/workflow trace tests in
  `test/launch-ops-trace.test.ts`.

### Implementation

- [x] T035 [US5] Add stable IR node identifiers and source spans in
  `src/model.ts` and parser/compiler paths.
- [x] T036 [US5] Implement trace collection in `src/language/trace.ts`.
- [x] T037 [US5] Emit schema, route, UI, authorization, audit, and test trace
  links from generators.
- [x] T038 [US5] Emit `intentlang.trace.json` with generated applications.
- [x] T039 [US5] Add Studio trace explorer and source/artifact navigation in
  `src/studio-assets.ts`.
- [x] T040 [US5] Document trace semantics in `docs/spec/traceability.md`.

**Checkpoint**: SC-006 achieved for LaunchOps representative rules.

---

## Phase 6: Adversarial Assurance (US6, P2)

- [x] T041 [P] [US6] Add seeded parser and formatter fuzz/property harness in
  `test/properties.test.ts`.
- [x] T042 [P] [US6] Add generated authorization-matrix tests in
  `test/authorization-matrix.test.ts`.
- [x] T043 [P] [US6] Add workflow state/invariant model tests in
  `test/workflow-invariants.test.ts`.
- [x] T044 [P] [US6] Add idempotency and transaction model tests in
  `test/runtime-properties.test.ts`.
- [x] T045 [P] [US6] Add Unicode, case, collision, and resource-limit corpus
  under `conformance/invalid/`.
- [x] T046 [US6] Add deterministic fuzz seeds and minimized regression fixture
  persistence.
- [x] T047 [US6] Add CI budgets and reporting for adversarial suites.

**Checkpoint**: SC-007 and release-scale SC-011 gates operational.

---

## Phase 7: Concise, Inspectable Abstractions (US3, P1)

### Role inheritance and policies

- [x] T048 [P] [US3] Write normative proposals for role inheritance and named
  policies under `docs/spec/proposals/`.
- [x] T049 [P] [US3] Add invalid-cycle, duplicate-grant, and conflict fixtures.
- [x] T050 [US3] Add role inheritance and policy AST/IR nodes.
- [x] T051 [US3] Implement exact policy expansion before validation/generation.
- [x] T052 [US3] Add canonical formatting and expanded-policy explanations.
- [x] T053 [US3] Add Studio “Show expanded permissions” view.

### Reusable declarations and workflows

- [ ] T054 [P] [US3] Specify reusable field groups and workflow/state-machine
  patterns.
- [ ] T055 [US3] Implement reusable declaration expansion with source trace
  preservation.
- [ ] T056 [US3] Implement explicit state-machine syntax and invariant checks.
- [x] T057 [US3] Rewrite LaunchOps using abstractions and prove equivalent
  expanded semantics.
- [x] T058 [US3] Measure authored lines, repetition ratio, and policy expansion.

**Checkpoint**: SC-008 achieved without hidden security effects.

---

## Phase 8: Modules, Imports, Namespaces, and Packages (US3, P1)

- [ ] T059 [P] [US3] Specify module/import/export/namespace/version semantics.
- [ ] T060 [P] [US3] Add module graph, cycle, conflict, and alias fixtures.
- [ ] T061 [US3] Implement module parser and resolver in
  `src/language/modules.ts`.
- [ ] T062 [US3] Preserve source locations, rule IDs, and trace links across
  modules.
- [ ] T063 [US3] Add dependency lock and integrity metadata.
- [ ] T064 [US3] Add Studio multi-file project navigation.
- [ ] T065 [US3] Split LaunchOps into modules and prove semantic fingerprint
  equivalence.

**Checkpoint**: SC-009 achieved.

---

## Phase 9: Reviewed Intent Resolution (US2, P1)

### Deterministic clarification

- [ ] T066 [P] [US2] Create ambiguity/context corpus under
  `conformance/ambiguous/intent/`.
- [ ] T067 [P] [US2] Specify clarification categories and question contracts.
- [ ] T068 [US2] Implement requirement concept/context model in
  `src/language/intent-resolution.ts`.
- [ ] T069 [US2] Implement deterministic security, ownership, workflow, type,
  default, and failure-mode clarifications.
- [ ] T070 [US2] Implement canonical proposal generation and deterministic
  compiler validation.

### Review experience

- [ ] T071 [US2] Add Studio clarification workflow and proposal diff.
- [ ] T072 [US2] Explain data, workflow, security, and side effects before
  confirmation.
- [ ] T073 [US2] Persist confirmation records and detect conflicts with existing
  canonical source.
- [ ] T074 [US2] Route optional AI proposals through the same authority-free
  proposal contract.
- [ ] T075 [US2] Add intent-resolution end-to-end browser tests.

**Checkpoint**: SC-002 and SC-010 achieved for the maintained corpus.

---

## Phase 10: Typed Computation and Query Language (US7, P2)

- [ ] T076 [P] [US7] Specify typed expressions, numeric precision, dates, time,
  money, enums, nullability, and errors.
- [ ] T077 [P] [US7] Specify functions/procedures, effects, recursion, and
  evaluation order.
- [ ] T078 [P] [US7] Specify collections, records, pattern matching, and
  iteration.
- [ ] T079 [P] [US7] Specify authorization-aware filtering, sorting, grouping,
  joins, and aggregation.
- [ ] T080 [US7] Implement typed expression/type-checking foundation.
- [ ] T081 [US7] Implement function/procedure IR and runtime.
- [ ] T082 [US7] Implement collection and record semantics.
- [ ] T083 [US7] Implement query planner and generated SQL/runtime behavior.
- [ ] T084 [US7] Add reference pricing and analytics applications.

---

## Phase 11: Transactions, Integrations, and Escape Hatches (US7, P2)

- [ ] T085 [P] [US7] Specify multi-record transaction and rollback semantics.
- [ ] T086 [P] [US7] Specify external contracts, retries, timeouts,
  idempotency, and secret references.
- [ ] T087 [P] [US7] Specify capability-scoped escape hatches and excluded
  guarantees.
- [ ] T088 [US7] Implement transaction planner/runtime.
- [ ] T089 [US7] Implement external contract validation and adapters.
- [ ] T090 [US7] Implement isolated escape-hatch execution and audit metadata.
- [ ] T091 [US7] Add failure-injection reference application and tests.

---

## Phase 12: Tooling and Independent Validation (US1/US5/US7, P2)

- [ ] T092 Implement complete LSP symbol/reference/rename/hover/completion/code
  action/semantic-token/module/trace navigation support.
- [ ] T093 Implement typed expression/query REPL.
- [ ] T094 Implement workflow, policy, and request debugger.
- [ ] T095 Publish standalone conformance runner.
- [ ] T096 Publish independent semantic manifest validator API/CLI.
- [ ] T097 Add correct-or-loud parity tests for every compilation backend.

---

## Phase 13: Human Evidence and Governance (US8/US9, P2)

- [ ] T098 [P] [US8] Define ethical, anonymized comprehension study protocol.
- [ ] T099 [P] [US8] Create equivalent IntentLang/conventional-language tasks.
- [ ] T100 [US8] Run pilot studies across domain experts, developers, security
  reviewers, and beginners.
- [ ] T101 [US8] Publish correctness, confidence, defect, timing, and retention
  findings, including negative results.
- [ ] T102 [P] [US9] Add language proposal template and checklist.
- [ ] T103 [US9] Add CI verification that language changes reference proposals,
  rules, fixtures, compatibility, traces, and docs.
- [ ] T104 [US9] Add release checklist for constitution and compatibility gates.
- [ ] T105 Commission independent security and specification review before
  stable-language graduation.

## Dependencies and First Delivery

### Required order

1. T001–T011 establish inventory infrastructure.
2. T012–T022 establish normative and conformance authority.
3. T023–T032 establish stable canonical semantics and compatibility.
4. T033–T040 establish traceability.
5. T041–T047 establish adversarial proof.
6. Only then may new stable syntax begin at T048.

### First implementation release

The first release SHOULD include T001–T040 plus T048–T058. This delivers:

- specification/conformance authority;
- semantic compatibility detection;
- cross-layer traceability; and
- immediate LaunchOps conciseness improvements.

### Parallel work

- T002/T003/T005 can proceed in parallel after T001.
- Inventory tasks T006–T009 can proceed in parallel.
- Test tasks within each phase can proceed in parallel before implementation.
- Documentation and fixture authoring can proceed in parallel with loaders once
  contracts are stable.

## Completion Rules

- Tests are written before implementation for semantic behavior.
- Each task updates its linked normative rule/evidence where applicable.
- No task is marked complete based solely on documentation or a demo.
- Every phase runs `npm run check`, targeted tests, full unit tests, and relevant
  browser/end-to-end suites.
- Each logical phase is committed separately with constitution and validation
  evidence.
