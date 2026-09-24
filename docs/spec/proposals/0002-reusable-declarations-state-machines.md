# Proposal 0002: Reusable Declarations and State Machines

**Status**: Implemented, experimental language surface

## Motivation

Repeated field shapes and free-standing workflow actions obscure shared intent.
These abstractions name the repetition while preserving the exact existing IR.

## Syntax

```intentlang
field group RecordTitle
  title as required text length between 2 and 200

apply fields RecordTitle to WorkItem

state machine WorkItemLifecycle for WorkItem using status
  transition start
    require status is "open" otherwise "Only an open work item can be started"
    set status to "in-progress"
```

## Semantics

Both declarations are compile-time only. Field applications expand to ordinary
natural field declarations. State-machine transitions expand to ordinary
actions in declaration order.

Every transition must contain at least one precondition and must assign the
declared state field. Transition names are unique within a machine. Empty,
duplicate, malformed, or unresolved abstractions fail explicitly.

Canonical formatting emits only the expanded fields and actions. The generated
runtime has no hidden field-group or state-machine behavior.

LaunchOps is the state-machine proof: six named machines expand to the original
14 actions with byte-for-byte equivalent canonical `ProgramIr`.
