# Page Language Core

## PAGE-STRUCTURE-001

A page program contains a root page and uniquely named elements. Elements are
created with `Add` or `Create`, may be placed inside a valid parent, and may
receive supported text, styles, and attributes.

```intentlang
Add a section called panel
Add a paragraph called status inside panel
Set the text of status to Ready
Make status bold
```

Element names resolve only to earlier declarations. Duplicate names, invalid
parent/child structures, containment cycles, unsupported capabilities, unsafe
URLs, executable attributes, and invalid CSS values are rejected. Ambiguous
property names require an explicit `style` or `attribute` choice.

## PAGE-EVENT-001

The page language supports page-load, button-click, value-change, and
Enter-in-input events:

```intentlang
When the page loads, set the text of status to Ready
When the go is clicked, set the text of status to Clicked
When the name changes, set the text of status to Changed
When enter is pressed in name, set the text of status to Submitted
```

Each event validates its target and accepts only the documented closed set of
runtime actions. Generated behavior uses event listeners rather than inline
event-handler attributes. User-controlled values remain data and are never
treated as JavaScript source.
