# Proposal 0001: Role Inheritance and Named Policies

**Status**: Implemented, experimental language surface

## Motivation

LaunchOps currently repeats many permission statements across roles. Repetition
makes reviews slower and increases the chance that one role accidentally misses
or gains a permission.

## Syntax

```intentlang
role Contributor
role ProgramManager extends Contributor

policy OwnedWork
  allow to read WorkItem
  allow to create and update own WorkItem
  allow to run all actions on own WorkItem

grant OwnedWork to Contributor
```

## Semantics

Role inheritance and policy grants are compile-time abstractions. They expand
before the existing permission parser, validator, IR, authorization runtime,
manifest, and generators run.

- A child role receives every effective permission of its parent.
- Inheritance is transitive.
- Cycles and unknown parents are errors.
- A policy contains one or more role-less `allow to ...` statements.
- A grant substitutes the target role into every policy statement.
- `manage` expands to create, read, and update in that order.
- Comma-and entity lists expand left to right.
- `run all actions` expands declared actions in source order and rejects an
  entity that declares no actions.
- Unknown policies, duplicate policies, empty policies, and duplicate effective
  grants are errors.
- There is no implicit deny override or conflict precedence.

Canonical formatting emits explicit expanded `allow` statements. Studio shows
the expansion source, target role, and generated permission statements.

## Compatibility

Programs without these declarations compile unchanged. An abstraction is
semantically equivalent only when its expanded `ProgramIr` fingerprint matches
the explicit program.

LaunchOps is the release proof: 24 authored policy, grant, and body lines expand
to the original 95 explicit permissions. Its canonical `ProgramIr` and semantic
fingerprint match the pre-abstraction snapshot exactly, reducing permission
repetition by 74.7% without changing runtime authority.
