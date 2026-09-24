# Feature Specification: IntentLang Language Assurance and Expansion

**Feature Branch**: `001-language-assurance`

**Created**: 2026-09-25

**Status**: Draft

**Input**: Address every practical concern raised about English-language
programming while evolving IntentLang into a robust, feature-rich,
application-level language that meets or exceeds mature language-engineering
standards.

## Vision

IntentLang MUST allow people to move from natural business intent to reviewed,
canonical, executable specifications without permitting ambiguity, missing
context, semantic drift, hidden security behavior, or silent compatibility
changes.

The program succeeds when IntentLang combines:

- approachable intent authoring;
- formal, versioned semantics;
- concise and modular source;
- secure whole-application generation;
- independently verifiable conformance;
- cross-layer traceability; and
- expressive programming capabilities.

## User Scenarios & Testing

### User Story 1 - Trust Every Accepted Program (Priority: P1)

As an application author or reviewer, I need every accepted IntentLang program
to have one documented meaning so I can trust what will run.

**Why this priority**: Ambiguity, missing context, and undefined semantics are
the central objections to programming with English. All other work depends on
this guarantee.

**Independent Test**: Run the normative conformance suite over valid, invalid,
ambiguous, and context-incomplete programs. Every input either produces the
specified typed meaning or an exact required diagnostic/clarification.

**Acceptance Scenarios**:

1. **Given** a valid canonical program, **When** it is compiled repeatedly,
   **Then** the same typed semantic model and semantic fingerprint are produced.
2. **Given** a statement with two plausible interpretations, **When** it is
   analyzed, **Then** compilation does not proceed until one interpretation is
   chosen or the statement is rejected.
3. **Given** a security-sensitive statement with missing context, **When** it is
   analyzed, **Then** the missing decisions are identified explicitly.
4. **Given** a language construct, **When** a reviewer follows its normative
   rule identifier, **Then** syntax, semantics, errors, canonical form, and
   runtime obligations are documented.

---

### User Story 2 - Convert Flexible Intent into Canonical Source (Priority: P1)

As a domain expert, I want to express a requirement naturally and resolve its
ambiguities through structured questions so I can produce precise IntentLang
without already knowing every grammar rule.

**Why this priority**: This is the principal differentiation from conventional
English-syntax languages: resolving business intent before execution.

**Independent Test**: Submit a curated corpus of natural requirements. Verify
that the intent-resolution layer identifies entities, workflows, permissions,
missing decisions, and unsupported capabilities; presents exact canonical
source; and requires confirmation before applying it.

**Acceptance Scenarios**:

1. **Given** “Contributors should only update risks they own,” **When** intent
   resolution completes, **Then** it proposes
   `allow Contributor to update Risk where owner is self`, explains backend
   enforcement, and requires confirmation.
2. **Given** “Managers approve expensive purchases,” **When** the threshold,
   self-approval rule, role identity, and post-approval state are unspecified,
   **Then** the system asks structured questions before producing source.
3. **Given** an AI-generated proposal, **When** deterministic validation fails,
   **Then** the proposal cannot modify durable source or generate an app.
4. **Given** a confirmed interpretation, **When** it is saved, **Then** future
   compilation does not depend on the original conversation.

---

### User Story 3 - Write Large Programs Concisely and Transparently (Priority: P1)

As an IntentLang author, I need reusable abstractions and modules so a system
like LaunchOps does not require repetitive declarations while reviewers can
still inspect every expanded permission and effect.

**Why this priority**: Conciseness and scalability are the strongest current
weaknesses and the largest practical barrier to serious applications.

**Independent Test**: Rewrite LaunchOps using role inheritance, named policies,
reusable workflows/field groups, and modules. Verify materially fewer authored
lines while producing a semantically equivalent expanded model and generated
application.

**Acceptance Scenarios**:

1. **Given** a role that includes another role, **When** permissions are
   expanded, **Then** inherited grants are explicit, deterministic, and
   reviewable.
2. **Given** a named owner policy applied to several entities, **When** Studio
   displays expanded permissions, **Then** every resulting grant and scope is
   visible.
3. **Given** LaunchOps split into multiple modules, **When** compiled, **Then**
   it produces the same semantic fingerprint as the equivalent single-file
   canonical program.
4. **Given** circular imports or conflicting exports, **When** compiled,
   **Then** precise source-located diagnostics are produced.

---

### User Story 4 - Prevent Silent Changes Across Releases (Priority: P1)

As a maintainer or application owner, I need compiler upgrades to reveal every
semantic or generated-contract change so existing applications cannot silently
change behavior.

**Why this priority**: Stable meaning over time is required for the language to
be trustworthy.

**Independent Test**: Compile historical fixtures with the release candidate
and compare canonical source, IR, semantic fingerprints, schema, routes,
permissions, workflows, and generated artifacts according to compatibility
policy.

**Acceptance Scenarios**:

1. **Given** a patch release, **When** historical accepted programs are
   recompiled, **Then** no semantic fingerprint changes are permitted.
2. **Given** an additive minor feature, **When** old programs are recompiled,
   **Then** their behavior remains unchanged.
3. **Given** a required breaking semantic change, **When** released, **Then** a
   major language version and migration guidance are required.
4. **Given** equivalent aliases, **When** formatted, **Then** they produce the
   same canonical source and fingerprint.

---

### User Story 5 - Trace Requirements Through the Whole Application (Priority: P1)

As a security reviewer, developer, or auditor, I need to follow each source rule
through the typed model and generated application so I can verify consistent
enforcement.

**Why this priority**: Cross-layer drift is a major source of application bugs
and a core IntentLang differentiator.

**Independent Test**: Select representative schema, workflow, ownership, and
permission rules and verify trace links to IR nodes, SQL objects, routes, UI
controls, authorization decisions, audit events, and automated tests.

**Acceptance Scenarios**:

1. **Given** `allow Contributor to update Risk where owner is self`, **When**
   traced, **Then** the reviewer sees the IR permission, UI behavior, backend
   authorization, query scope, audit behavior, and tests.
2. **Given** an action assignment, **When** traced, **Then** its dialog effect,
   endpoint, precondition evaluation, database update, and tests are linked.
3. **Given** a generated artifact, **When** inspected, **Then** relevant source
   ranges and normative rules can be identified.
4. **Given** a generator interpretation weaker than the normative semantics,
   **When** conformance tests run, **Then** the build fails.

---

### User Story 6 - Prove Robustness Adversarially (Priority: P2)

As a language maintainer, I need property tests, fuzzing, security matrices, and
resource limits so correctness claims survive inputs beyond curated examples.

**Why this priority**: Example-based tests cannot prove parser safety,
authorization completeness, deterministic formatting, or state-machine
invariants.

**Independent Test**: Run automated generated-input suites over parsing,
formatting, authorization combinations, workflows, migrations, and runtime
limits.

**Acceptance Scenarios**:

1. **Given** arbitrary bounded input, **When** parsed, **Then** the parser
   terminates within declared resource limits without crashing.
2. **Given** canonical source, **When** formatted repeatedly, **Then** output is
   stable after the first formatting pass.
3. **Given** every role, entity, operation, ownership relation, and record
   owner combination, **When** authorization is evaluated, **Then** results
   match the expanded policy model.
4. **Given** repeated requests with the same idempotency key, **When** executed,
   **Then** effects are applied at most once.
5. **Given** a workflow, **When** arbitrary valid action sequences execute,
   **Then** no undeclared state is reached.

---

### User Story 7 - Use the Best Formal Notation for Each Concept (Priority: P2)

As an application author, I need typed expressions, collections, queries,
functions, state machines, transactions, integrations, and controlled escape
hatches so IntentLang can implement serious applications without verbose
pseudo-English.

**Why this priority**: A language cannot surpass mature alternatives while
remaining limited to CRUD declarations and small runtime instructions.

**Independent Test**: Build reference applications that require calculations,
aggregations, reusable logic, multi-record workflows, external APIs, and custom
UI behavior, while preserving deterministic and security guarantees.

**Acceptance Scenarios**:

1. **Given** a calculation, **When** expressed mathematically, **Then** types,
   precision, evaluation order, and errors are specified.
2. **Given** a query with filtering, sorting, grouping, and aggregation,
   **When** compiled, **Then** execution semantics and authorization scope are
   consistent.
3. **Given** a transaction spanning multiple records, **When** any operation
   fails, **Then** all declared effects roll back.
4. **Given** an escape hatch, **When** used, **Then** bypassed guarantees and
   required permissions are explicit, and the unsafe content is isolated.

---

### User Story 8 - Demonstrate Human Comprehension (Priority: P2)

As a project maintainer or prospective adopter, I need evidence showing who
understands IntentLang better, where it reduces errors, and where conventional
notation remains superior.

**Why this priority**: Readability is an empirical claim, and English-looking
syntax can create dangerous false confidence.

**Independent Test**: Conduct repeatable studies comparing IntentLang with
equivalent requirements plus conventional implementation artifacts across
domain experts, developers, security reviewers, and beginners.

**Acceptance Scenarios**:

1. **Given** representative programs, **When** participants explain behavior,
   **Then** correctness, confidence, and interpretation differences are
   recorded separately.
2. **Given** a requested modification, **When** participants implement it,
   **Then** time, defects, and security regressions are measured.
3. **Given** delayed retesting, **When** participants return, **Then** retention
   and relearning time are measured.
4. **Given** evidence that another notation is clearer, **When** the language is
   designed, **Then** the clearer formal notation is preferred over prose.

---

### User Story 9 - Govern Every Language Change (Priority: P2)

As a contributor or maintainer, I need a mandatory proposal and evidence process
so vocabulary and semantics cannot grow inconsistently.

**Why this priority**: Uncontrolled feature growth would recreate the ambiguity
and complexity of unrestricted natural language.

**Independent Test**: Submit a sample language proposal and verify that CI and
review templates require grammar, semantics, ambiguity analysis, IR,
compatibility, security, diagnostics, tests, traceability, and documentation.

**Acceptance Scenarios**:

1. **Given** a parser-only syntax change, **When** reviewed, **Then** it is
   incomplete and cannot merge.
2. **Given** a proposal without compatibility classification, **When** checked,
   **Then** the quality gate fails.
3. **Given** a complete proposal, **When** implemented, **Then** every required
   evidence artifact is linked from the change.

## Edge Cases

- Input is grammatically valid but references two names differing only by case.
- An alias is valid in one language version but removed in another.
- A clarification answer conflicts with previously confirmed canonical source.
- Two modules export the same name through different import paths.
- Role inheritance creates a cycle or contradictory grants.
- Policy expansion produces duplicate or overlapping permissions.
- A source-only reordering changes order-sensitive semantics.
- A formatter loses comments, rationale, or source traceability.
- A generated SQL optimization weakens owner filtering.
- An expression is deterministic mathematically but platform-dependent due to
  floating-point behavior.
- An integration returns data violating the declared external contract.
- An escape hatch attempts to access capabilities not explicitly granted.
- A migration changes constraints while preserving the high-level entity shape.
- A release changes diagnostic codes relied upon by external tooling.
- Intent resolution has insufficient confidence but offers a proposal anyway.
- A user confirms an interpretation without reviewing security consequences.

## Requirements

### Functional Requirements

- **FR-001 — Ambiguity**: The system MUST ensure every accepted program has one
  normative interpretation; unresolved ambiguity MUST clarify or reject.
- **FR-002 — Context closure**: The system MUST reject accepted-program
  dependencies on undeclared names, hidden state, conversation history, or
  security-sensitive assumptions.
- **FR-003 — Normative semantics**: Every accepted construct MUST map to a
  stable normative rule covering syntax, semantics, errors, canonical form,
  runtime obligations, and compatibility.
- **FR-004 — Canonicalization**: Every accepted alias MUST normalize to one
  canonical source form and equivalent typed representation.
- **FR-005 — Determinism**: Compilation MUST emit language, IR, compiler,
  generator, dependency, source, and semantic fingerprints and reproduce
  identical semantic output for identical declared inputs.
- **FR-006 — Cross-layer traceability**: Source rules MUST trace to IR, UI, API,
  database, authorization, audit, tests, and documentation where applicable.
- **FR-007 — Security construction**: Authorization MUST remain default-deny;
  ownership and security rules MUST be enforced at authoritative runtime
  boundaries and fail closed when unsupported.
- **FR-008 — Concise abstractions**: The language MUST support exact,
  inspectable expansion of role inheritance, policies, reusable declarations,
  workflows, and other approved abstractions.
- **FR-009 — Modularity**: The language MUST support deterministic modules,
  imports, exports, namespaces, source-located diagnostics, and dependency
  compatibility.
- **FR-010 — Compatibility**: Releases MUST enforce published semantic
  versioning and historical compatibility gates with migration guidance for
  breaking changes.
- **FR-011 — Conformance**: Every normative rule MUST have applicable positive,
  negative, ambiguity, canonical, property, and runtime fixtures.
- **FR-012 — Adversarial verification**: The project MUST maintain fuzzing,
  resource-limit, formatter-property, authorization-matrix, workflow-invariant,
  idempotency, migration, and security tests.
- **FR-013 — Readability evidence**: Readability and usability claims MUST be
  supported by repeatable studies measuring correctness, confidence, change
  safety, defects, and retention.
- **FR-014 — Governance**: Every language change MUST use a proposal contract
  covering grammar, semantics, ambiguity, IR, security, compatibility,
  diagnostics, tests, traceability, and documentation.
- **FR-015 — Intent resolution**: Broader natural input MUST be converted into
  explained, reviewed, canonical source before execution authority is granted.
- **FR-016 — Expressiveness**: The language roadmap MUST cover typed
  expressions, collections, functions, queries, state machines, transactions,
  integrations, packages, and controlled escape hatches.
- **FR-017 — Explainability**: Studio MUST explain expanded permissions,
  workflow effects, data consequences, generated obligations, and guarantees
  bypassed by escape hatches.
- **FR-018 — Correct-or-loud backends**: Generators and transpilers MUST refuse
  unsupported constructs rather than emit incomplete or behaviorally divergent
  output.
- **FR-019 — Independent validation**: The normative specification and
  conformance suite MUST be sufficient for an independent implementation or
  validator to determine whether behavior conforms.
- **FR-020 — Competitive evidence**: Feature comparisons MUST distinguish
  implemented, tested capabilities from experimental or planned claims and
  MUST prioritize user outcomes over checklist parity.

### Key Entities

- **NormativeRule**: Stable identifier, syntax, semantics, errors, canonical
  form, obligations, compatibility class, and linked evidence.
- **CanonicalProgram**: Context-closed durable source with language version,
  imports, rationale, and semantic fingerprint.
- **IntentProposal**: Natural input, extracted concepts, unresolved questions,
  proposed canonical changes, explanations, confidence, and review state.
- **Clarification**: Structured question, allowed answer shape, security impact,
  selected answer, and resulting canonical decision.
- **Module**: Named source unit with imports, exports, namespace, version
  requirements, and fingerprint.
- **Policy**: Reusable authorization abstraction with exact expanded grants and
  scopes.
- **Workflow**: States, transitions, preconditions, assignments, invariants, and
  expanded runtime obligations.
- **TraceLink**: Relationship from source range and normative rule to IR node,
  generated artifact range/object, and test evidence.
- **ConformanceFixture**: Input, language version, expected canonical source,
  expected IR/fingerprint, expected diagnostics, and runtime assertions.
- **CompatibilityBaseline**: Historical source and expected semantic/generated
  contracts for a released version.
- **StudyResult**: Participant cohort, task, correctness, confidence, timing,
  defects, retention, and qualitative feedback.
- **LanguageProposal**: Complete governance record for a language change.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of accepted constructs in the stable language have normative
  rule identifiers and linked conformance fixtures.
- **SC-002**: 100% of ambiguity-corpus inputs are uniquely interpreted,
  explicitly clarified, or rejected; zero are silently guessed.
- **SC-003**: Formatting any canonical fixture twice yields byte-identical
  output after the first pass.
- **SC-004**: Repeated compilation of every conformance fixture yields the same
  semantic fingerprint and deterministic generated artifacts.
- **SC-005**: Historical compatibility CI detects 100% of intentionally injected
  semantic changes to permissions, workflows, schema, routes, and canonical
  source.
- **SC-006**: Every stable security/workflow construct has at least one
  cross-layer test proving equivalent UI, API, authorization, database, audit,
  and trace behavior where applicable.
- **SC-007**: Authorization-matrix tests cover every role × entity × operation ×
  scope combination in each reference application.
- **SC-008**: LaunchOps expressed with approved abstractions reduces authored
  permission/workflow boilerplate by at least 60% while producing an equivalent
  expanded policy and application behavior.
- **SC-009**: Modular LaunchOps and its single-file equivalent produce the same
  semantic fingerprint.
- **SC-010**: Intent-resolution studies achieve at least 95% correct canonical
  interpretations after clarification, with 0 security-sensitive unanswered
  questions permitted at confirmation.
- **SC-011**: Parser/property fuzzing completes at least one million generated
  cases per stable release with no crash, hang, unbounded growth, or silent
  divergent parse.
- **SC-012**: Reference applications demonstrate typed calculations, reusable
  functions, collections, queries/aggregation, explicit state machines,
  multi-record transactions, external integrations, and controlled escape
  hatches.
- **SC-013**: At least two independent user cohorts demonstrate statistically
  lower interpretation or modification error rates for target IntentLang tasks,
  with false-confidence rates reported publicly.
- **SC-014**: An independent validator using only the normative specification
  and conformance data can validate canonical source and semantic fingerprints
  for the stable core.
- **SC-015**: No stable language feature can merge without all constitutionally
  required proposal and evidence fields.

## Assumptions

- The current compiler, typed IR, generators, Studio, examples, and test suites
  remain the starting implementation.
- Existing accepted source remains supported unless a major-version migration
  is explicitly approved.
- The project continues to generate conventional inspectable artifacts rather
  than replacing them with an opaque hosted runtime.
- Optional AI remains an authoring assistant, never the authority for runtime
  semantics.
- The program will be delivered incrementally; each increment MUST preserve the
  constitution even when the complete roadmap is not yet implemented.
- Competitive research, including EPL, informs engineering standards but does
  not define product requirements by checklist.

## Out of Scope for the First Delivery Increment

- Immediate implementation of every general-purpose language feature.
- Claiming production readiness before independent security and usability
  evaluation.
- Supporting arbitrary unrestricted English without review.
- Replacing all existing syntax in a single breaking release.
- Adding multiple compilation backends before semantic conformance and
  correct-or-loud behavior are established.
