# IntentLang Conformance Suite

Fixtures are grouped by observable expectation:

- `valid/`: accepted programs and required semantic results
- `invalid/`: rejected programs and required diagnostics
- `ambiguous/`: programs that must not compile without clarification
- `canonical/`: source-to-canonical-source expectations
- `runtime/`: generated behavior and cross-layer obligations
- `compatibility/`: historical semantic baselines

Every fixture must cite at least one normative rule ID.
