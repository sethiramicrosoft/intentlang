# Independent Tooling

## LANGUAGE-SERVICE-001

Document intelligence is derived from source plus compiler output. Positions
are zero-based UTF-16 line and character pairs. Diagnostics remain compiler
diagnostics. Rename returns edits only for exact symbol tokens and never writes
files. Module imports are document links, and trace navigation returns the same
rule and generated-artifact links as Studio.

The stdio server supports initialize, open/change/close synchronization,
diagnostics, document symbols, definition, references, rename, hover,
completion, code actions, semantic tokens, document links, and
`intentlang/trace`.

## TOOLING-EVALUATION-001

The expression REPL accepts an expression plus explicit type and value
environments and returns the inferred type and exact result. The query REPL
accepts a typed query definition, rows, and an authorization callback.

Workflow debugging evaluates every precondition without mutation and reports
the projected assignments only when all checks pass. Authorization debugging
reports matching permissions and scope checks. Request debugging combines both
decisions.

## INDEPENDENT-VALIDATION-001

The standalone conformance runner executes selected fixture categories and
returns one structured result per fixture. The semantic manifest validator
recomputes source, semantic, dependency, and IR fingerprints from the embedded
IR and dependencies.

Backend parity checks require every entity and field in database output, every
entity/action/permission in runtime output, and every entity/action/role in UI
output. Unsupported or missing obligations produce explicit failures.
