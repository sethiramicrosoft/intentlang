# Proposal 0007: Human Evidence and Language Governance

**Status**: Implemented

## Problem and user scenario

IntentLang claims readability, safety, and explainability. Repository tests
cannot prove how humans interpret programs, and feature pressure can bypass
specification evidence unless governance is executable.

## Normative rule identifiers

- `HUMAN-GOVERNANCE-001` — experimental governance obligation.

## Grammar and canonical form

This proposal adds no executable program syntax. Governance artifacts use
versioned Markdown and JSON. Study results use the closed anonymized result
schema.

## Typed semantics and IR

No program IR changes. The governance report is a typed list of issue codes,
messages, optional paths, and changed language files. Study analysis consumes
validated anonymized results and emits aggregates only.

## Ambiguity and context closure

Study representation, cohort, assignment group, scoring rubric, exclusions,
timing, confidence, and study version are explicit. Missing governance evidence
fails CI.

## Interaction with existing constructs

The gate validates rule, inventory, specification, evidence, compatibility,
traceability, documentation, proposal, release, and review-package links.
Language-affecting pull requests must change every applicable evidence surface.

## Security and privacy effects

The study prohibits names, contact details, employer data, IP addresses,
sensitive demographics, credentials, proprietary code, and free-form personal
histories. Independent vulnerability findings follow coordinated disclosure.

## Compatibility and migration

This is additive tooling and process. Existing source semantics are unchanged.
New language changes must satisfy the stricter proposal template.

## Diagnostics and recovery

Governance diagnostics use `G001`–`G008`. Each identifies a missing artifact,
invalid corpus, broken registry link, sequence problem, or incomplete change
evidence.

## Generator and runtime obligations

No application runtime obligations. CI runs the governance validator before
language assurance.

## Evidence plan

Repository and synthetic change-set tests verify passing and failing governance
outcomes. Study aggregation is tested with synthetic anonymized records.

## Documentation and examples

Protocol, task corpus, result schema, status, proposal template, change
checklist, release checklist, review brief, report template, PR template, and
README status are included.

## Traceability

`HUMAN-GOVERNANCE-001` links to `TOOL-OBL-005`, this proposal, the normative
chapter, governance tests, CI, and the study/review artifacts.

## Measurable outcome

Every language-affecting change is rejected when required evidence surfaces are
absent. Study materials support counterbalanced measurement across four
participant cohorts.

## Graduation criteria

The governance rule may become stable after the pilot materials receive ethics
review, real findings are published, an independent reviewer completes the
security/specification report, and the CI gate has operated successfully across
multiple external contributions.
