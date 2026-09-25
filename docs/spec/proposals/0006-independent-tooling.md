# Proposal 0006: Independent Language Tooling

**Status**: Experimental implementation

## Problem

IntentLang intelligence currently lives partly inside Studio and assurance
checks partly inside repository tests. Editors and external tools need stable,
machine-readable services without importing private UI or compiler internals.

## Language service

The language service exposes compiler diagnostics, document symbols,
definitions, references, safe whole-symbol rename edits, hover information,
context-aware completions, diagnostic code actions, semantic tokens, module
links, and source-to-generated trace links. The stdio server uses standard LSP
framing and never executes source.

## REPL and debugger

The typed REPL evaluates exact expressions or authorization-aware query plans
from explicit typed inputs. The debugger explains workflow preconditions,
assignments, permission candidates, ownership scope, and final request
decisions without mutating records.

## Independent validation

The conformance runner returns structured fixture outcomes. The semantic
manifest validator checks schema, versions, fingerprints, dependency identity,
and generator metadata. Backend parity checks fail when database, runtime, or
UI output omits a required semantic node.

## Compatibility

These are additive tooling APIs and CLI commands. They do not change accepted
program semantics or generated application behavior.
