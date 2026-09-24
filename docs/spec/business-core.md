# Business Application Core

This chapter defines the initial normative subset of the IntentLang business
application language. The rule registry and conformance suite are part of this
specification.

## APP-DECL-001

Each source program must declare exactly one application. The canonical form is:

```intentlang
application Name with id stable-id
```

`Name` begins with an uppercase ASCII letter and contains only ASCII letters or
digits. `stable-id` begins with a lowercase ASCII letter and contains only
lowercase ASCII letters, digits, or hyphens.

The accepted shorthand `application Name` derives the stable ID by converting
the name to its lowercase slug. Canonical formatting always emits the explicit
form. Missing and duplicate application declarations are errors; the compiler
must not choose one declaration implicitly.

## ENTITY-DECL-001

An entity has a unique application-scoped name and a globally unique stable ID:

```intentlang
entity Task with id task
```

Names and stable IDs cannot be silently renamed or merged. The canonical source
always records the explicit stable ID.

## FIELD-DECL-001

A field is indented by exactly two spaces beneath its entity and has this
canonical shape:

```intentlang
  title is required unique text with id task-title length between 1 and 200 default "Untitled"
```

The supported scalar types are `text`, `integer`, and `boolean`. `required` and
`unique` are independent modifiers. Length constraints apply only to text and
must have a minimum of at least one that is lower than the maximum. Defaults
must match the field type and all field invariants.

The natural form `a Task has a required title as text` derives the entity and
field IDs. Canonical formatting expands it to explicit entity and field
declarations.
