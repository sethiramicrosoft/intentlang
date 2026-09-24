# Cross-Layer Traceability

Generated business applications include `intentlang.trace.json`. The trace map
connects source declarations to normative rules, stable IR node IDs, and
generated artifacts.

Each link contains:

- the source file and inclusive start/end lines;
- one or more normative rule IDs;
- one stable IR node ID;
- generated artifact paths and, where useful, route or symbol names; and
- optional tests that prove the obligation.

Natural declarations still receive stable links. For example, the source line
`a Task has a required title as text` links both the derived `task` entity and
the derived `task-title` field to their canonical IR nodes.

Action links span the action header, preconditions, and assignments. Permission
links preserve source order and map to deterministic permission IDs.

Trace maps are explanatory evidence, not an authorization mechanism. Runtime
security continues to be enforced from the typed security model. Missing trace
links are release failures because they prevent reviewers from proving that a
source requirement reached the database, backend, UI, and tests.
