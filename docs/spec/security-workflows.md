# Relationships, Workflows, and Authorization

## REL-DECL-001

A belongs-to relationship resolves two declared entities, has a globally unique
stable ID, and names its delete behavior explicitly:

```intentlang
Task belongs to User as owner with id task-owner on delete restrict
```

The accepted delete behaviors are `restrict` and `cascade`. `set null` is
rejected because the current belongs-to model is required. Both endpoint
entities must exist; unresolved references are errors.

## ACTION-DECL-001

An action declares an entity transition with at least one typed precondition and
one typed assignment:

```intentlang
action complete a Task with id task-complete
  require done is false otherwise "Task is already complete"
  set done to true
```

All referenced fields must exist. Literal values must match field types.
Ordering comparisons apply only to integer fields. A field may be assigned at
most once, system fields cannot be assigned, and a transition that is provably
a no-op is rejected. Generated execution checks preconditions and applies
assignments in one transaction.

## AUTH-DECL-001

Authentication is declared at most once:

```intentlang
authentication uses User identified by email
```

The identity entity must exist. Its identity field must be required, unique,
and text. Roles, permissions, and account provisioning are invalid without a
valid authentication declaration.

## ROLE-DECL-001

A role has a unique name and stable ID:

```intentlang
role Member with id member
```

The shorthand `role Member` derives `member`; canonical formatting emits the
explicit ID. Roles have no implicit privileges.

## PERMISSION-DECL-001

Permissions are explicit allow rules. The absence of a matching rule denies the
operation. Supported operations are entity create/read/update, action
execution, and account provisioning.

Self scope applies only to the identity entity. Owner scope requires an
`owner` relationship from the protected entity to the identity entity.
`create ... with owner as self` overwrites the ownership input with the
authenticated identity. Duplicate rules are rejected.

## SOURCE-STRUCTURE-001

Blank lines and lines whose first non-whitespace character is `#` have no
semantic effect. Any other sentence must match a defined grammar rule or the
compiler emits `E001`; unknown English is never guessed.

## POLICY-EXPANSION-001

Named policies and role inheritance are experimental compile-time
abstractions. They expand into the existing explicit permission language before
parsing, validation, IR construction, generation, or runtime authorization:

```intentlang
role Contributor
role Manager extends Contributor

policy OwnedTasks
  allow to read Task
  allow to create and update own Task
  allow to run all actions on own Task

grant OwnedTasks to Contributor
```

Policy macros may group entity lists, expand `manage` into create/read/update,
expand owner-scoped create/update, and enumerate every declared action for an
entity. A run-all macro naming an entity with no actions is rejected rather
than silently granting nothing.

Unknown policies or roles, duplicate policies or effective permissions, empty
policies, unknown parents, and inheritance cycles are errors. Canonical
formatting emits only the exact expanded `allow` statements. Runtime authority
continues to come exclusively from those explicit permissions.

## DECLARATION-EXPANSION-001

Reusable field groups and state machines are experimental compile-time
abstractions:

```intentlang
field group Titled
  title as required text length between 2 and 200

apply fields Titled to WorkItem

state machine WorkItemLifecycle for WorkItem using status
  transition start
    require status is "open" otherwise "Only an open work item can be started"
    set status to "in-progress"
```

Field applications expand to ordinary field declarations. Transitions expand
to ordinary actions in declaration order. Every transition must have a
precondition and must assign its machine's declared state field. Duplicate or
empty groups, machines, and transitions are errors. Canonical formatting and
all downstream generators see only the expanded stable language.
