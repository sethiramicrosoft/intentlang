# Research: Language Assurance and Competitive Direction

## Decision 1: Controlled intent, not unrestricted execution

**Decision**: Broader English is accepted only by an intent-resolution proposal
layer. Canonical IntentLang remains the executable authority.

**Rationale**: This preserves deterministic semantics while addressing the
usability gap between natural requirements and formal source.

**Rejected alternative**: Execute arbitrary English directly. This would allow
context dependence, probabilistic meaning, and silent ambiguity.

## Decision 2: Learn from mature English-syntax languages without copying scope

**Observation**: EPL demonstrates a substantial structured-English
general-purpose language with lexer/parser/AST, interpreter, VM, LLVM,
transpilers, packages, LSP, REPL, debugger, formal grammar, parity tests, fuzzing,
and deployment tooling.

**Decision**: Match or exceed mature compiler/tooling rigor while differentiating
through intent clarification, application-level semantics, security by
construction, traceability, and whole-application generation.

**Rejected alternative**: Compete primarily on the number of compilation targets
or English keywords. That would dilute IntentLang’s strongest value.

## Decision 3: Specification plus conformance

**Decision**: Maintain both a human-readable normative specification and a
machine-readable rule registry/conformance suite.

**Rationale**: Prose is reviewable; data is enforceable. Neither alone is
sufficient.

## Decision 4: Semantic fingerprints

**Decision**: Hash canonical normalized semantics separately from source and
artifacts.

**Rationale**: Formatting changes, semantic changes, and generator-only changes
need different compatibility consequences.

## Decision 5: Expand abstractions into explicit IR

**Decision**: Role inheritance, policies, reusable workflows, and field groups
must expand into explicit grants/nodes before validation and generation.

**Rationale**: Reviewers and security tests need to inspect exact effects.

## Decision 6: Empirical readability

**Decision**: Treat readability as a measurable product quality, not a marketing
assumption.

**Rationale**: English-looking syntax can increase false confidence. Studies
must report correctness separately from perceived confidence.
