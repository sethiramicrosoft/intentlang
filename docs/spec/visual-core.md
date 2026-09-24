# Visual Language Core

## VIS-DISPLAY-001

A visual program must contain a display instruction. The simplest canonical
form is:

```intentlang
Show IntentLang
```

The displayed content must be non-empty and no longer than 2,000 characters.
Quoted text must contain valid JSON string escapes. Unknown sentences are
rejected rather than interpreted approximately.

## VIS-AMBIGUITY-001

Pronouns such as `it` are accepted only when exactly one compatible earlier
target exists. If no target exists, or both text and background are plausible,
the compiler emits ambiguity diagnostic `V008`, changes nothing, and offers
explicit alternatives.

For example, `Make it red` cannot begin a program because `it` has no resolved
referent. The author must write `Make the text red` or
`Make the background red`.
