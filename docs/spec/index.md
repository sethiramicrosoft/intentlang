# IntentLang Language Specification

This directory is the human-readable normative specification for IntentLang.
Tutorials and examples explain how to use the language; this specification
defines what programs mean.

## Sources of authority

1. Normative prose in this directory defines grammar and semantics.
2. Machine-readable entries in `language/rules/` identify each obligation.
3. Rule-linked fixtures in `conformance/` provide executable evidence.
4. If prose, registry, and fixtures disagree, the conflict is a release blocker.

Generated applications and demonstrations are evidence, not independent
language definitions.

## Rule IDs

Rule IDs use `<AREA>-<SUBAREA>-<NNN>`, for example `APP-DECL-001`. IDs are
permanent after publication and must not be reassigned. The registry records
whether a rule is experimental, stable, deprecated, or removed.

Every stable rule must include:

- a canonical source form;
- a compatibility class;
- positive and negative evidence;
- canonical evidence when formatting is defined; and
- runtime evidence when the rule affects generated behavior.

## Change discipline

A language change is incomplete until it updates the applicable proposal,
normative prose, rule registry, conformance fixtures, compatibility baselines,
traceability expectations, and user documentation. Implementations must reject
unresolved ambiguity rather than silently infer semantics.
