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

## VIS-LAYOUT-001

Text may retain its written layout, place each word on a separate line, or place
all displayed text on one line. More than one instruction cannot set the same
layout property.

## VIS-STYLE-001

Styles target the text or background explicitly. Supported text properties
include bounded pixel or named sizes, weight, slant, underline, and named
colors. The background supports named colors. Unsupported values, incompatible
targets, and multiple instructions for the same property are errors.

## VIS-MOTION-001

Text may be placed at `left`, `right`, `top`, `bottom`, or `center`. Motion must
run between opposite edges and use a duration from 0.1 through 60 seconds.
`across` without a direction is ambiguous and requires the author to select a
generated explicit alternative.
