# Visual language: Hello World to HTML pages

The visual language compiles a finite English grammar into a typed scene or
document tree and a standalone HTML page. It does not use AI, create a
database, or execute user-supplied JavaScript. Existing business-app commands and
`.intent` examples are unchanged.

## Try it locally

With Node.js 24 or newer and the repository dependencies installed:

```powershell
npm run sample:studio
```

Open `http://127.0.0.1:3211/playground`, or follow **Try the visual language** from
the App Builder. The preview recompiles after a short typing pause. **Run / replay**
restarts the animation. Examples replace the editor, with confirmation if you
have changed its contents. Edits are kept only in the current tab: use
**Download source** to save them, and **Download HTML** for a compiled page.
Invalid input clears the preview and disables HTML download.

Start with:

```text
Show Hello, world!
```

Add:

```text
Make the text blue
Make the background light blue
Make the text large and bold
```

Choose one movement instruction:

```text
Move the text from left to right over 3 seconds
```

Replace it to experiment:

```text
Move the text from right to left over 3 seconds
```

```text
Move the text from top to bottom over 3 seconds
```

```text
Move the text from bottom to top over 3 seconds
```

## Multi-element pages

```text
Add a section called welcome
Add a heading called greeting inside welcome
Set the text of greeting to Hello world
Make greeting large and bold
Set the background color of welcome to light blue
Set the padding of welcome to 24 pixels
```

Use **Browse HTML and CSS capabilities** in the playground to search the actual
compiler catalogue. Available elements include insertion examples with required
parent containers. For styles and attributes, choose an existing target, enter
a value, and insert an instruction. Restricted capabilities remain visible with
their reasons.

The pinned `@vscode/web-custom-data` 0.6.3 catalogue is derived from HTML
specification and MDN data. Of its 116 element entries, this implementation exposes
96 for creation; the rest are compiler-managed or restricted. Of its 888 CSS
property entries, 512 are available through the pinned value validator and policy.
These counts measure the implemented construction/property surface, **not full
HTML conformance, complete English interpretation, or uniform browser support**.

### Page instructions

- `Add a section called welcome` creates an element at the page root.
  `Create` and `named` can replace `Add` and `called`.
- `Add a heading called greeting inside welcome` creates a child. Every element
  needs a unique name. Names ignore case and can contain several words, such as
  `main greeting`. The instruction words `called`, `named`, `inside`, `of`, and
  `to` cannot occur in names. The names `page`, `background`, and `it` are reserved.
- `Put greeting inside welcome` reparents an earlier element. Cycles are errors.
  Parents must already exist when used in Add or Put.
- `Set the text of greeting to Hello world` sets the element's leading plain text.
  Text is data, not markup: case, punctuation, quotes, backslashes, and Unicode
  are preserved. Child elements follow this text. Void elements such as images
  cannot contain text; use their alternative text or a control's value instead.
- `Set the color of greeting to rebeccapurple` sets a standard CSS property.
  Write property names with spaces: `font size`, `border radius`, `letter spacing`,
  `background color`, `margin bottom`, `grid template columns`, etc.
  Values are checked against CSS grammar, not pasted into a stylesheet.
- Common units have English forms: `24 pixels`, `100 percent`, `2 root ems`,
  `1.5 ems`, `2 seconds`, `200 milliseconds`, and `90 degrees`.
  Common values such as `light blue`, `space between`, `inline block`, and
  `no wrap` are normalized. Native CSS value syntax is also accepted when valid.
  Complex functions, custom properties, selectors, pseudo-classes, responsive
  breakpoints and keyframe definitions do not have English constructions yet.
- `Make greeting large, bold and underlined` reuses the scene style vocabulary.
  `Underline greeting` is equivalent. `Make the background navy` styles the page.
  For styles outside these shorthands, use `Set the property of name to value`.
- `Set the source of portrait to https://example.com/photo.png` supplies an image
  URL. `Set the alternative text of portrait to A mountain` supplies its text
  alternative. Resource URLs preserve case. Images, audio, video, and fonts can
  load explicitly named HTTPS resources; those exports need network access.
- `Set the destination of more to explanation` links to a named element already
  declared. HTTPS URLs and relative destinations are also accepted.
- Attributes are checked against the element's catalogue entry. For example,
  `Set the required of email to yes`, `Set the checked of consent to no`,
  and `Set the placeholder of email to you@example.com`.
  Boolean false removes the attribute; it does not emit a misleading string false.
  Other attribute values are escaped and use native browser semantics. Only
  selected closed enumerations are validated, not every HTML attribute's
  value-dependent constraint.
- `Set the linked control of email label to email` connects a label to an input.
  Reference attributes use element names rather than generated IDs. Multiple-target
  attributes such as `described by` accept comma-separated names. References in
  attributes may point to later declarations.
- `Set the accessible name of email to Email address` sets its accessible name.
  Standard ARIA attributes also use space-separated words such as `aria live`.
- `Add a checkbox called consent` is shorthand for an input with that type.
  Other input presets: text input, email input, password input, number input,
  date input, color picker, radio button, slider, and file picker.
- `it` is resolved only when exactly one earlier page element is eligible;
  otherwise the IDE offers explicit names. It never means a silently guessed
  "most recent" element.
- When an attribute and a style share a name, the IDE asks which is intended:
  `Set the width of portrait to 120` needs clarification.
  Use `Set the attribute width of portrait to 120` or
  `Set the style width of portrait to 120 pixels`.
- Set values are literal: do not add sentence-ending punctuation unless it belongs
  in the value. Add, Put, Make, and Underline accept an optional final period.
  A property may be assigned once; edit an existing assignment to change it.
- Several page instructions can be chained on one line with `and then`, the same
  connector a click's own instructions already use: `Add a paragraph called label
  and then set the text of label to Note` both creates the element and fills it
  in, in one sentence. A plain `and` that is not `and then` is never treated as a
  chain split, so ordinary display text such as `salt and pepper` is unaffected.
  A `When ... is clicked`/`When the page loads`/`When ... changes`/`When
  enter is pressed in ...` trigger's own
  body already chains its instructions with `and then` through the click
  compiler, so that sentence is never re-split at this level.

The `page` root is the generated body. Pages use normal document flow, not the
single-text scene's absolute positioning. They permit 200 created elements,
32 nesting levels, and 20000 source characters. The compiler checks common
parent/child constraints and verifies that HTML parsing will not discard or
rearrange the requested elements. Browsers may insert implicit containers, such
as a table body. This is not a complete HTML conformance validator.

Programs containing Add/Create or the property-of-target Set grammar use the page
compiler. Existing scene programs retain their original output. A page can use
`Show Hello world` to create a paragraph named `text`, but scene movement,
placement, and word-layout commands cannot yet be combined with Add instructions;
the compiler diagnoses them instead of silently dropping them.

### Native behavior and current limits

Details/summary expansion, checkbox toggling, text entry, select options, native
constraint validation and media controls are browser behavior, not generated
JavaScript. Buttons default to ordinary buttons, not submission. Forms do not
submit data; generated pages prohibit form actions. The preview sandbox also
blocks new windows and submissions.

**`When the <button name> is clicked, <one or more instructions>.`** adds a real
runtime click handler. This is still plain English, and the instruction is
still a fixed, closed set (chained with `and then` the same way everywhere
else in the language is): `set the text of <name> to <value>`,
`set the text of <name> to the value of <input name>`,
`set the text of <name> to a random number from <min> to <max>`,
`add <number> to the text of <name>`, `subtract <number> from the text of
<name>`, `multiply the text of <name> by <number>`, `divide the text of
<name> by <number>` (dividing by exactly 0 is a clear compile-time error,
not an undefined/NaN result), `add the value of <input name> to the text of
<name>`,
`subtract the value of <input name> from the text of <name>` (the live-input
siblings of the plain-number add/subtract, for totaling up whatever a visitor
actually typed rather than a fixed amount), `multiply the text of <name> by
the value of <input name>`, and `divide the text of <name> by the value of
<input name>` (the same live-input siblings for multiply/divide — since a
live input's value isn't known until the click actually happens, a zero
divisor can't be caught at compile time here, so the generated code itself
guards it at runtime, leaving the running total unchanged rather than
producing NaN/Infinity), and `if the value of <input
name> is greater than/less than/at least/at most/equal to <number>, <one
instruction>` optionally followed by `otherwise <one instruction>` (a real
runtime conditional, with an optional else branch, so a click can behave
differently depending on what a visitor actually typed) — the right-hand
side of that comparison can be a plain number or another live input's value
(`if the value of a is greater than the value of b, ...`), for comparing
two things a visitor actually typed against each other. A sixth form,
`if the value of <input name> is between <low> and <high>, <one
instruction>` (also optionally followed by `otherwise <one instruction>`),
checks an inclusive range in one step instead of writing two separate
comparisons. Either end can be a plain number known at compile time, or (the
same as `ifValue`'s own right-hand side) another live input's own value
(`if the value of score is between the value of low bound and the value of
high bound, ...` or a mix of the two, such as `is between 1 and the value of
high bound`), so a valid window can itself move with whatever a visitor
actually typed rather than only ever being fixed. A backwards range (a low
end greater than the high end) is a clear compile-time error rather than a
condition that's silently always false — but only when both ends are still
plain numbers; once either end is a live input's value, a would-be-backwards
window can only be discovered at runtime, where the generated condition
itself simply never matches instead. A related form checks a live text's own length
instead of its value: `if the value of <input name> has more than/fewer
than/at least/at most/exactly <number> characters, <one instruction>`
(also optionally followed by `otherwise <one instruction>`) — handy for a
minimum password length or a maximum username length, without needing a
separate word-count helper. The character count can also be another live
input's own length instead of a fixed number, with `has more than/fewer
than/at least/at most/exactly as many characters as the value of <other
input name>, <one instruction>` — for comparing two fields' lengths
directly, such as confirming a "confirm password" field is exactly as long
as "password" before even checking whether their text actually matches.
The same `if` can
also compare live text instead of numbers, with `is`, `is not`, `contains`,
`starts with`, or `ends with` (`if the value of message contains urgent,
...`) — the numeric comparisons (including `is between ... and ...` and
`has ... characters`) are
always tried first, so a phrase like
`is greater than 50` still runs the numeric check, while anything else after
`is`/`is not` (including a whole phrase) is compared as literal text; the
right-hand side of a text comparison can likewise be a plain word/phrase or
another live input's value (`if the value of a is the value of b, ...`).
A dropdown has its own condition sibling for this: `if the selected label
of <dropdown name> is/is not <text>, <one instruction>` (also optionally
followed by `otherwise <one instruction>`) compares the selected option's
own displayed text directly, the read-side counterpart of `set the value
of ... to the option labeled ...` — unlike `if the value of <dropdown> is
...`, which compares the raw, possibly-divergent `.value`, this always
reflects exactly what a visitor saw and picked.
A click can also write into a live input's own value (as opposed to
`set the text of ...`, which only changes what's displayed elsewhere):
`set the value of <input name> to <text>` and `set the value of <input
name> to the value of <other input name>` (a live copy from one input to
another) preset a field, and `clear the value of <input name>` resets it to
empty — handy for clearing a form after its value has already been read
into a result. `add <number> to the value of <input name>` and `subtract
<number> from the value of <input name>` step a live input's own value up
or down by a fixed amount in place — the value-target sibling of `add
<number> to the text of <name>`, for a "+"/"-" quantity-stepper button
pair sitting right next to a number input, rather than only being able to
total a fixed amount into some other displayed text. `add the value of
<input name> to the value of <other input name>` and `subtract the value
of <input name> from the value of <other input name>` do the same thing
but with a live amount instead of a fixed one — the value-target sibling
of `add the value of ... to the text of ...` — so a stepper's own step
size can itself come from another field instead of always being the same
fixed number. `multiply the value of <input name> by <number>` and
`divide the value of <input name> by <number>` are the multiplicative
value-target siblings of the same pair — the value-target counterparts of
`multiply the text of <name> by <number>` — so a stepper can scale its own
value by a factor rather than only adding a fixed amount (dividing by
exactly 0 is a clear compile-time error here too). `multiply the value of
<input name> by the value of <other input name>` and `divide the value of
<input name> by the value of <other input name>` are their live-factor
siblings, matching how `multiply the text of ... by the value of ...`
already lets a live input drive a text target's factor — a live divisor of
0 is guarded at runtime the same way, leaving the target's value unchanged
rather than producing NaN/Infinity. `set the value of
<dropdown name> to the option labeled
<text>` is the write-side sibling of `the selected label of ...`: it
selects an option by its own displayed text directly (the target must be a
dropdown specifically), regardless of that option's actual value attribute
— handy once an option's value has been set to something other than its
label (a short code, say), so a click can still pick an option the same
way a visitor reads it, without needing to know the underlying code. The
target of `set/clear the value of ...` must likewise be
an input, a text box, or a dropdown. A checkbox or radio button doesn't have
a meaningful `.value` (it's a fixed attribute, never reflecting whether it's
actually ticked) — it has a `.checked` state instead, so it gets its own
forms: `if <checkbox name> is checked, <one instruction>` (optionally with
`the` before the name, and optionally followed by `otherwise <one
instruction>`) branches on whether it's ticked, `if <checkbox name> is not
checked, ...` branches on the opposite, and `check <checkbox name>` /
`uncheck <checkbox name>` tick or untick it directly from a click, and
`toggle whether <checkbox name> is checked` flips it without needing to
know which way it currently is. The
target of any of these must be a checkbox or a radio button specifically —
using them on a text input or any other element is a clear error. A radio
button's whole point is mutual exclusivity, so every radio button added
directly under the same parent (the same grouping IntentLang already uses
for containers) is automatically given a shared HTML `name` attribute
behind the scenes, with no extra syntax required — picking one radio
button natively un-picks every other radio button under that same parent,
exactly like a real form, while a radio button under a different parent
starts its own, separate group. A click
can also change whether any element is on the page at all (not just its
text or value): `hide <name>` and `show <name>` set or clear its visibility,
and `toggle the visibility of <name>` flips whichever state it's currently
in. These use the element's native `hidden` property, the same mechanism a
screen reader or the keyboard-navigation order respects, rather than a
CSS-only trick that would still leave a "hidden" element focusable and
readable by assistive technology. Unlike the value/checked-state
instructions above, there's no type restriction here — any element on the
page, from a paragraph to the whole page body, can be hidden, shown, or
toggled. `focus <name>` moves keyboard focus to any element directly — most
useful right after a `show`, so a keyboard or screen-reader user lands
inside newly-revealed content (a search box, a details panel) instead of
being left behind on the button that triggered it. `disable <name>` and
`enable <name>` set or clear a form control's native `disabled` property —
the same real, built-in mechanism a browser uses to skip a control in the
tab order and describe it as unavailable to assistive technology, rather
than a CSS-only "looks greyed out" trick that a keyboard user could still
activate. Handy for keeping a submit button disabled until a checkbox is
ticked, or a field disabled until an earlier step is complete. The target
must be a button, an input, a text box, a dropdown, an option group, or a
field group specifically — the only elements whose `disabled` property the
browser actually honors; using it on a paragraph or any other element is a
clear error.

**`When the page loads, <one or more instructions>.`** runs the exact same
closed instruction set immediately, as soon as the page's markup exists,
instead of waiting for a click — for setting up a default, rolling an
opening random number, or otherwise giving the page a live starting state
without needing a visitor to click anything first. It shares one compiler
with `When ... is clicked` (so every instruction documented above, including
`if`, `repeat`, and `otherwise`, works exactly the same way here), and its
instructions run before any click handler is registered, in source order —
so a later click can still visibly override whatever a page-load default
set. The compiler turns
every `When ... is clicked`, `When the page loads`, `When ... changes`, or
`When enter is pressed in ...`
sentence in a page into
ONE small, entirely
compiler-generated script (never containing any user-authored markup,
attribute, or script tag — only compiler-fixed code with your text safely
embedded as a JSON string), and pins that exact script into the page's
Content-Security-Policy by its SHA-256 hash. A page that doesn't use either
form stays exactly as script-free as before, byte for byte. The
target of "is clicked" must be a button (a native, keyboard-operable
control), so this never creates a click-only trap for people who use a
keyboard or assistive technology instead of a mouse. The source of
"the value of ..." must be an input, a text box, or a dropdown (anything with
a live value to read) — using anything else there is a clear error, whether
it's the direct source of a `set ... to the value of ...`, the source of an
`add/subtract the value of ...` amount, or either side of an `if the value
of ...` comparison. A dropdown's own `.value` is its selected option's value
attribute, or that option's own displayed text when it has no explicit value
attribute set — but once an option's value diverges from its label (`Set the
value of red to r`), reading `the value of ...` no longer reflects what the
visitor actually saw and picked. `set the text of <target> to the selected
label of <dropdown name>` reads the selected option's own displayed text
directly, regardless of its value attribute; the source must be a dropdown
specifically. `set the text of <target> to the number of characters in
the value of <input/text box/dropdown name>` reads a live field's own
current length directly — the live-value sibling of the compile-time-only
`if the value of ... has ... characters` comparison (and of the separate
`the length of ...` list/text helper): it measures what's actually typed or
selected right now, so pairing it with `When ... changes` gives a
live-updating character counter without a separate button click. The source
must likewise be an input, a text box, or a dropdown. A random range's low end can't be greater than its high
end (`from 6 to 1` is a clear error, not a silently reversed or empty range)
— both ends are whole numbers, and the roll is inclusive of both. Both the
`if`'s own instruction and its optional `otherwise` instruction can be any of
the other supported instructions (including another `add the value of ...`
or a `repeat ... times, ...`), but each is exactly one instruction, not its
own `and then` chain — chain further instructions after the whole
`if ... otherwise ...` at the top level instead, and they'll run every time
the button is clicked, regardless of which branch (or neither, if there's no
`otherwise`) actually ran. `repeat <count> times, <one instruction>` runs its
one instruction that many times in a row on every click — the count can be a
fixed whole number known at compile time (0 or more, and at most 100000; a
negative count is a clear error rather than silently running zero times), or
`repeat the value of <input name> times, <one instruction>` to run it as
many times as a visitor actually typed — since a live count can't be range-
checked at compile time, the generated code itself clamps it into that same
[0, 100000] window instead, so neither a negative nor a huge typed value can
ever cause a runaway loop or a startling error mid-click. Repeats nest safely, including a repeat inside another repeat's
own instruction, or inside an `if`'s instruction.

**`When the <input/text box/dropdown name> changes, <one or more
instructions>.`** is a third trigger, alongside a click and the page
loading — it fires on the native browser `change` event, so it reacts the
moment a visitor picks a dropdown option, or commits an edit to a text
field (leaving the field, or pressing Enter), rather than requiring a
separate button click just to notice what they typed or chose. It shares
the exact same closed instruction set and compiler as the other two
triggers. The target must be an input, a text box, or a dropdown
specifically (the only elements with a live value that can meaningfully
"change") — using it on a button or any other element is a clear error,
with a hint suggesting a text input instead.

**`When enter is pressed in <input/text box/dropdown name>, <one or more
instructions>.`** is a fourth trigger, for reacting to the Enter key itself
rather than waiting for a field to lose focus (as `changes` does) or
requiring a separate submit button — useful for a single-field
search box or quick-entry form. It fires on the browser's native `keydown`
event, checks that the pressed key really is Enter, and calls
`preventDefault()` so the browser's own default Enter behavior for a text
field doesn't do anything unexpected; it shares the exact same closed
instruction set and compiler as the other three triggers. The target must
likewise be an input, a text box, or a dropdown.

```text
Add a paragraph called counter
Set the text of counter to 0
Add a button called increment
Set the text of increment to Add one
When the increment is clicked, add 1 to the text of counter
```

```text
Add a text input called name field
Add a paragraph called greeting
Add a button called submit
Set the text of submit to Say hello
When the submit is clicked, set the text of greeting to the value of name field
```

```text
Add a paragraph called roll
Add a button called dice
Set the text of dice to Roll
When the dice is clicked, set the text of roll to a random number from 1 to 6
```

```text
Add a text input called amount field
Add a paragraph called total
Set the text of total to 0
Add a button called add
Set the text of add to Add
When the add is clicked, add the value of amount field to the text of total
```

```text
Add a paragraph called total
Set the text of total to 5
Add a button called double
Set the text of double to Double
Add a button called halve
Set the text of halve to Halve
When the double is clicked, multiply the text of total by 2
When the halve is clicked, divide the text of total by 2
```

```text
Add a text input called factor
Add a paragraph called total
Set the text of total to 5
Add a button called scale
Set the text of scale to Scale
Add a button called shrink
Set the text of shrink to Shrink
When the scale is clicked, multiply the text of total by the value of factor
When the shrink is clicked, divide the text of total by the value of factor
```

```text
Add a text input called score field
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of score field is greater than 50, set the text of result to high otherwise set the text of result to low
```

```text
Add a text input called score field
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of score field is between 1 and 10, set the text of result to valid otherwise set the text of result to out of range
```

```text
Add a text input called score field
Add a text input called low bound
Add a text input called high bound
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of score field is between the value of low bound and the value of high bound, set the text of result to valid otherwise set the text of result to out of range
```

```text
Add a text input called password
Add a paragraph called hint
Set the text of hint to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of password has fewer than 8 characters, set the text of hint to too short otherwise set the text of hint to looks good
```

```text
Add a text input called password
Add a text input called confirm password
Add a paragraph called hint
Set the text of hint to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of confirm password has exactly as many characters as the value of password, set the text of hint to same length otherwise set the text of hint to different length
```

```text
Add a text input called a
Add a text input called b
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of a is greater than the value of b, set the text of result to a wins otherwise set the text of result to b wins
```

```text
Add a text input called message
Add a paragraph called result
Set the text of result to none
Add a button called check
Set the text of check to Check
When the check is clicked, if the value of message contains urgent, set the text of result to flagged otherwise set the text of result to normal
```

```text
Add a text input called message
Add a paragraph called result
Set the text of result to none
Add a button called send
Set the text of send to Send
When the send is clicked, set the text of result to the value of message and then clear the value of message
```

```text
Add a checkbox called agree
Add a paragraph called result
Set the text of result to none
Add a button called submit
Set the text of submit to Submit
When the submit is clicked, if agree is checked, set the text of result to thanks otherwise set the text of result to please agree first
```

```text
Add a checkbox called agree
Add a button called turn
Set the text of turn to Toggle agreement
When the turn is clicked, toggle whether agree is checked
```

```text
Add a radio button called small
Add a radio button called medium
Add a radio button called large
Add a paragraph called result
Set the text of result to Pick a size
When the small changes, set the text of result to small
When the medium changes, set the text of result to medium
When the large changes, set the text of result to large
```

```text
Add a paragraph called details
Set the text of details to The full terms go here.
Add a button called toggle
Set the text of toggle to Show details
When the toggle is clicked, toggle the visibility of details
```

```text
Add a dropdown called favorite color
Add an option called red inside favorite color
Add an option called blue inside favorite color
Set the text of red to Red
Set the text of blue to Blue
Add a paragraph called result
Set the text of result to Pick a color
When the favorite color changes, set the text of result to the value of favorite color
```

```text
Add a dropdown called country
Add an option called us inside country
Add an option called uk inside country
Set the text of us to United States
Set the text of uk to United Kingdom
Set the value of us to US
Set the value of uk to UK
Add a paragraph called result
Set the text of result to Pick a country
When the country changes, set the text of result to the selected label of country
```

```text
Add a dropdown called country
Add an option called us inside country
Add an option called uk inside country
Set the text of us to United States
Set the text of uk to United Kingdom
Set the value of us to US
Set the value of uk to UK
Add a button called pick uk
Set the text of pick uk to Default to United Kingdom
When the pick uk is clicked, set the value of country to the option labeled United Kingdom
```

```text
Add a dropdown called country
Add an option called us inside country
Add an option called uk inside country
Set the text of us to United States
Set the text of uk to United Kingdom
Set the value of us to US
Set the value of uk to UK
Add a paragraph called result
Set the text of result to Pick a country
Add a button called check
Set the text of check to Check
When the check is clicked, if the selected label of country is United Kingdom, set the text of result to across the pond otherwise set the text of result to elsewhere
```

```text
Add a text input called message
Add a paragraph called counter
Set the text of counter to 0
When the message changes, set the text of counter to the number of characters in the value of message
```

```text
Add a number input called quantity
Set the value of quantity to 1
Add a button called increase
Set the text of increase to +
Add a button called decrease
Set the text of decrease to -
When the increase is clicked, add 1 to the value of quantity
When the decrease is clicked, subtract 1 from the value of quantity
```

```text
Add a number input called step size
Set the value of step size to 5
Add a number input called quantity
Set the value of quantity to 0
Add a button called increase
Set the text of increase to +
When the increase is clicked, add the value of step size to the value of quantity
```

```text
Add a number input called quantity
Set the value of quantity to 5
Add a button called double
Set the text of double to Double
Add a button called halve
Set the text of halve to Halve
When the double is clicked, multiply the value of quantity by 2
When the halve is clicked, divide the value of quantity by 2
```

```text
Add a text input called search field
Add a paragraph called result
Set the text of result to Type and press Enter
When enter is pressed in search field, set the text of result to the value of search field
```

```text
Add a text input called search field
Add a button called open search
Set the text of open search to Search
When the open search is clicked, show search field and then focus search field
```

```text
Add a checkbox called agree
Add a button called submit
Set the text of submit to Submit
When the page loads, disable submit
When the agree changes, if agree is checked, enable submit otherwise disable submit
```

```text
Add a paragraph called roll
Set the text of roll to 0
When the page loads, set the text of roll to a random number from 1 to 6
```

```text
Add a paragraph called counter
Set the text of counter to 0
Add a button called go
Set the text of go to Go
When the go is clicked, repeat 5 times, add 1 to the text of counter
```

```text
Add a number input called times
Set the value of times to 3
Add a paragraph called counter
Set the text of counter to 0
Add a button called go
Set the text of go to Go
When the go is clicked, repeat the value of times times, add 1 to the text of counter
```

The second example is real user input, not compile-time data: whatever a
visitor actually types into the box is read live, the moment the button is
clicked. The third rolls a genuine new random number in the browser on every
click, unlike everything else on this page, which is computed once at compile
time. The fourth combines both ideas — it reads whatever number a visitor
actually typed into the input, live, and adds it into the running total shown
elsewhere on the page, the same way `add 1 to the text of ...` would with a
fixed amount, except the amount itself is real user input. The fifth branches
on that live input at click time: it shows "high" or "low" depending on what a
visitor actually typed, entirely in the browser, with no server involved.
The sixth compares two visitors' inputs (well, one visitor typing into two
boxes) directly against each other, rather than against a fixed number. The
seventh adds 1 to the counter five times in a row on a single click, the same
as writing `add 1 to the text of counter and then add 1 to the text of
counter and then ...` five times by hand, but without repeating yourself.

User-authored `<script>` elements, `onclick`-style inline event-handler
attributes, arbitrary stylesheets, embedded documents, templates, shadow-DOM,
canvas-drawing, SVG/MathML, named page-animation, and backend features are
still not implemented and remain refused — the compiler is still the only
thing that can ever put JavaScript on a page, and only for the one sanctioned
runtime shape above. The compiler manages the HTML document shell and security
policy. Vendor-specific or unvalidated CSS entries remain restricted.
The capability browser and `GET /api/visual/capabilities` explain these limits.
Adding catalogue entries alone is not sufficient to implement new behavior.

See **A complete page**, **Native form controls**, and **A real table** in the
example selector. Every available element and style property has generated
compiler coverage, and every available element is also checked in a real browser.
Behavioral browser tests cover representative controls, layouts, exports, and
responsive sizes; they do not claim to test every attribute/style combination.

## Plain-English variables, conditions, and repetition

A small set of sentence shapes adds compile-time computation to any page.
This is still plain English (no colons, no code blocks, no "end" keywords) and
still produces static HTML: nothing here runs after the page loads.

```text
The wins is 14.
The draws is 6.
The points is the wins times 3.
The total points is the points plus the draws.
The season summary is Season record joined with " " joined with the wins.
Set the text of points line to total points

If the total points is at least 40, set the text of form line to Promotion form and then set the text of banner to Well played.
Otherwise, set the text of form line to Steady form.

If the wins is at least 10 and the draws is at least 5, set the text of banner to Consistent season.

For each opponent in Ashford Town, Bellmoor United and Castlebridge, add a list item called result opponent inside fixtures

The rivals is a list of Ashford Town, Bellmoor United and Castlebridge.
For each rival in rivals, add a list item called rival line rival inside rivals list

For each round from 1 to 5, add a list item called round line round inside fixtures

Repeat 3 times, the wins is wins plus 1.
```

- **`The <name> is <value>.`** defines or recomputes a variable. The value can be
  a plain number, an existing variable, or an arithmetic chain: `plus`, `minus`,
  `times`, `divided by`, or `modulo` (remainder after division) another number
  or variable, joined as many times in a
  row as needed (`The total is a plus b minus c.`). A chain always evaluates
  strictly left to right, with no operator precedence — the same order it
  reads in English — so `a minus b times c` computes `(a minus b) times c`,
  not `a minus (b times c)`; write two separate variable sentences if you need
  the other grouping. Dividing or taking the modulo of a chain by zero is a
  clear error, the same for both operators. A value can also be plain text, either bare words (`The
  winner is Alex Carter.`) or a quoted phrase (`The motto is "Play as a
  team".`) — quotes are only needed if the text itself could be confused with
  a number or another variable's name. Text has its own chain operator,
  `joined with`, which concatenates two or more operands end to end (`The
  full name is the first name joined with " " joined with the last name.`) —
  it's a separate word from `plus` on purpose, so a number chain and a text
  chain never look alike, and so plain text can still safely contain the bare
  word "plus". Each operand in a `joined with` chain can be a variable
  (stringified if it's a number) or a literal — quote a literal that's just
  whitespace, like `" "`, since bare whitespace alone isn't a word.
  Text also has two built-in conversions: **`the uppercase of <text>`** and
  **`the lowercase of <text>`** produce an upper- or lower-cased copy of a
  text value or variable (`The shout is the uppercase of name.`), and can be
  nested (`the uppercase of the lowercase of name`). They work anywhere a
  text value is expected: an assignment, a `joined with` chain operand
  (`the uppercase of name joined with "!"`), an If condition's subject or
  target, or a procedure call argument. Separately, **`the length of
  <text>`** resolves to that text's character count as a number, so it can
  be used anywhere a number is expected: an assignment, an arithmetic
  chain (`the length of name plus 1`), or an If condition (`If the length
  of name is greater than 2, ...`). **`the rounded value of <number>`**
  resolves to that number rounded to the nearest whole number (half rounds
  up, the same rule `Math.round` uses), and works anywhere a number is
  expected, the same as `the length of ...` does — including composing
  with a list aggregate whose result often isn't a whole number, like
  `the rounded value of the average of scores`.
- **`If the <name> is <comparison> <value>, <one or more instructions>.`** keeps
  its instruction(s) only when the comparison is true. Comparisons are written
  as words: `greater than`, `less than`, `equal to`, `not equal to`, `at least`,
  `at most`. Text variables can use all six too — the ordering comparators
  compare text alphabetically (plain code-point order, case-insensitive, so
  `Alex` reads as coming before `Zack`) — but a list variable can still only be
  compared with `equal to` or `not equal to` (ordering doesn't make sense for a
  whole list); using another comparator on a list is reported as a clear
  error. The `<name>` can be a variable, or a plain number (useful when it's a
  For each counting loop's own variable, which is a number itself). A text
  variable can also be compared with three substring comparators —
  **`contains`**, **`starts with`**, and **`ends with`** (all
  case-insensitive) — and, since these already read like ordinary verbs,
  the leading `is` before them is optional: `If the name contains Carter,
  ...` and `If the name is contains Carter, ...` both work, whichever reads
  more naturally to you. Each has a negated counterpart, written with
  `does not` instead of `is` (or nothing at all): **`does not contain`**,
  **`does not start with`**, and **`does not end with`** (`If the name does
  not contain Smith, ...`). A list variable can use `contains` or `does not
  contain` too, but with a different meaning from text: it checks whether
  any one item in the list equals the given value exactly (`If the favorite
  colors contains green, ...`), rather than a substring check — `starts
  with`/`ends with` (and their negations) don't apply to a whole list, only
  to text. Comparing a plain number with any of these six comparators is a
  clear error, since they only make sense for text and lists.
- **`If the <name>, <one or more instructions>.`** (or **`If not the <name>,
  ...`**) is a shorter, plain-boolean way to write a condition, without
  spelling out "is equal to true" every time. A number is true when it's
  non-zero. Text must literally be `true` or `false` (case-insensitive) —
  comparing anything else this way is reported as a clear error, since an
  arbitrary piece of text (like a name) has no obvious true/false reading; use
  the ordinary `is equal to ...` form to compare it instead. A list has no
  true/false reading of its own either — compare `the number of items in ...`
  to `0` instead. `not` only negates this bare form; to negate an ordinary
  comparison, flip the comparator instead (`is not equal to`, or swap
  `greater than` for `at most`, etc.).
- **`If the <name> is <comparison> <value> and the <name> is <comparison>
  <value>, ...`** (or joined with `or` instead of `and`) combines two or more
  conditions into one: `and` requires every one of them to be true, `or`
  requires at least one. Chain as many as you like, all joined the same way
  (`... and the c is equal to 3 and the d is equal to 4, ...`), and a bare
  boolean clause (`the <name>` or `not the <name>`) can be mixed in among
  them the same way (`the isReady and the score is greater than 3, ...`).
  Mixing `and`
  and `or` in the same If sentence is ambiguous — there's no operator
  precedence in this language, on purpose — and is reported as a clear error;
  use only one connector per If sentence, or split it into two separate If
  sentences instead. Every clause is always checked, even once the overall
  result is already decided, so a mistake in any clause is always caught the
  same way no matter what order the values come in.
- **`Otherwise, <one or more instructions>.`** runs when the If sentence right
  before it was false.
- **`Otherwise if the <name> is <comparison> <value>, <one or more
  instructions>.`** chains a second (or third, fourth, ...) condition onto the
  same If, the same way "else if" works in other languages: it only runs
  when every earlier condition in the chain was false *and* its own
  condition is true. Once any branch in the chain has run, every later
  `Otherwise if` in that same chain is skipped without even checking its own
  condition, and a chain can still end with a plain `Otherwise` to cover
  whatever no `Otherwise if` matched:
  ```text
  If the score is at least 90, set the text of grade to A
  Otherwise if the score is at least 80, set the text of grade to B
  Otherwise if the score is at least 60, set the text of grade to C
  Otherwise, set the text of grade to F
  ```
  A second, unrelated `Otherwise` (or `Otherwise if`) right after one that
  already ran is a clear error, not a silent re-run, since a plain
  `Otherwise` always closes its chain.
- **`For each <name> in <item, item and item>, <one or more instructions>.`**
  repeats its instruction(s) once per item, replacing the loop word wherever
  it appears. When there's more than one instruction, every instruction runs
  for one item before moving to the next, so an element you add can be
  referenced by a later instruction for that same item. `<item, item and
  item>` can be an inline list written right there, or the name of a list
  variable defined earlier (see below) — either way reads the same.
- **`The <name> is a list of <item, item and item>.`** defines a named list
  variable, using the exact same item-list grammar as a For each's own inline
  list. Once defined, it can be looped over by name (`For each color in
  favorite colors, ...`), displayed directly (it reads back the same way it
  was written, e.g. `"red, green and blue"`), copied to another name (`The
  backup colors is favorite colors.`), measured with **`the number of
  items in <list>`**, which resolves to a plain number wherever a number
  could go — an arithmetic operand, or an If condition's subject or target
  (`If the number of items in favorite colors is equal to 3, ...`), and read
  one item at a time by position with **`item <N> in <list>`** (1-based:
  `item 1 in favorite colors` is the first color) or the convenience words
  **`the first item in <list>`** / **`the last item in <list>`**. A read item
  works anywhere a number or piece of text could go — an assignment's value,
  an If condition's target, or a `Set the text of ... to ...` — and comes
  back as a number if it looks like one (so a list of numbers can be indexed
  into and used in arithmetic directly). One item can also be changed in
  place with **`Set item <N> in <list> to <value>.`** (or `Set the first/last
  item in <list> to <value>.`), which keeps the list's identity — the same
  variable, with every other item unchanged — and resolves its value the
  same way an assignment does (a number expression, or otherwise plain
  text). When every item in a list is a number, it can also be totaled with
  **`the sum of <list>`** or averaged with **`the average of <list>`**, and
  its largest and smallest items found with **`the highest of <list>`** and
  **`the lowest of <list>`** — all four resolve to a plain number wherever a
  number could go, the same as `the number of items in <list>` does: an
  arithmetic operand (`the sum of scores plus 10`), an If condition's
  subject (`If the average of scores is greater than 50, ...`), or a
  `joined with` text chain operand. Asking for the number of items in,
  reading an item from, or setting an item in something that isn't a list —
  or a position that's out of range — is reported as a clear error rather
  than silently returning zero or blank text; the same is true of asking for
  the sum, average, highest or lowest of something that isn't a list, or a
  list that has even one non-numeric item.
- **`For each <name> from <start> to <end>, <one or more instructions>.`**
  counts through every whole number from `<start>` to `<end>`, inclusive of
  both ends, replacing the loop word with each number in turn. Counts upward
  when `<start>` is less than or equal to `<end>`, downward otherwise
  (`For each round from 5 to 1, ...` counts 5, 4, 3, 2, 1).
- **`Repeat <count> times, <one or more instructions>.`** runs its
  instruction(s) that many times in a row, with no loop word of its own —
  simpler than a For each counting loop when nothing needs to vary per
  iteration, such as accumulating a total (`Repeat 3 times, the total is
  total plus 1.`). `<count>` can be a plain number or a numeric expression.
  A count of `0` is valid and simply runs nothing; a negative count is
  reported as a clear error instead of silently running zero times.

An If, Otherwise, For each, or Repeat sentence can carry several instructions
by joining them with **`and then`**, for example:
`If the score is at least 40, set the text of form line to Promotion form and then set the text of banner to Well played.`
Plain `and` is never treated as a chain separator (so it stays safe to use
inside ordinary text or a For each list) — only the exact phrase `and then`
splits a sentence into multiple instructions.

An If or Otherwise sentence's instruction can itself be another If, Otherwise-
paired If, For each, or Repeat sentence, written right there on the same
line — and a For each's or Repeat's own repeated instruction can do the
same, nesting an If, For each, or another Repeat:

```text
If the score is greater than 10, if the wins is greater than 5, set the text of message to double win
Otherwise, if the consolation is greater than 5, set the text of message to good try
If the show is equal to 1, for each color in red and blue, add a list item called swatch color inside colors
For each color in red and blue, if the threshold is equal to 1, add a list item called swatch color inside colors
For each row in a and b, for each column in x and y, add a list item called cell row column inside grid
If the flag is equal to 1, repeat 3 times, the total is total plus 1.
Repeat 2 times, for each round from 1 to 3, add a list item called badge round inside colors
```

Nesting can go as deep as you like this way. A nested If's own condition never
affects an outer If's pending Otherwise — only the outermost If on a line
decides whether that line's Otherwise runs. A nested For each's list is found
by locating that list's own `and` rather than by guessing from comma
position, so a nested instruction's commas (from a nested If, say) never get
mistaken for list items.

Note the difference between `Otherwise, if ...` (a comma right after
"Otherwise", from the nesting shown above — a plain Otherwise whose own
instruction just happens to be another, independent If) and `Otherwise if
...` (no comma — the dedicated "else if" chain described earlier). They read
almost identically but behave differently: the comma form's nested If has no
memory of the outer chain (it doesn't skip itself once some earlier branch
already ran, and nothing can follow it with a further plain `Otherwise` of
its own on the next line, since that would pair with the *nested* If, not
the outer one); the no-comma form is chain-aware. Prefer `Otherwise if`
whenever the intent is a true "else if" ladder.

### Reusable procedures

**`To <name>, <one or more instructions>.`** defines a named, reusable group
of instructions — it produces no output by itself. **`Do <name>.`** calls it,
running its instructions right there. A call can appear anywhere a plain
instruction can: on its own line, chained with `and then`, or as the
instruction inside an If, Otherwise, or For each.

```text
To announce the winner, set the text of banner to Champions and then set the text of message to Well played.

If the total points is at least 40, do announce the winner.
```

A procedure can be called before the line that defines it (like a real
function), and one procedure can call another. Calling a procedure that was
never defined, or one whose name is close to a defined one, is reported the
same way an unknown variable is — as a clear error, with a "did you mean"
fix when there's an obvious match. Defining the same name twice, or a
procedure that calls itself (directly, or through another procedure), is
also a clear error rather than a silent surprise or a compiler that hangs.

A procedure can optionally take one or more parameters, using the word
`with`: **`To <name> with <param>, <instructions>.`** defines it, and
**`Do <name> with <value>.`** calls it with a specific value each time.

```text
To greet with person, set the text of message to person

Do greet with Alex Carter.
```

A procedure can take more than one parameter by joining their names with
`and`: **`To <name> with <param1> and <param2>, <instructions>.`**. A call
supplies one value per parameter, in the same order, joined either with
`and` or as a natural English list (`3, 4 and 5`):

```text
To add with a and b, set the text of message to a plus b

Do add with 3 and 4.
```

A parameter *definition*'s own list must be joined with `and` only — never a
comma — because a comma there would be indistinguishable from the comma that
ends the parameter list and starts the procedure's body. A *call*'s value
list has no such restriction, so it can use either style. Calling a
procedure with the wrong number of values (too few or too many) is reported
as a clear error naming exactly how many values it needs. Defining two
parameters with the same name is also a clear error.

Inside the procedure's own instructions, each parameter behaves just like a
variable defined with a `The ... is ...` sentence — it can be used anywhere a
variable can, including in comparisons, arithmetic, and other variable
sentences. Each parameter is only bound for the duration of that one call:
if a variable with the same name already existed outside the procedure, its
value is temporarily set aside and restored once the call finishes, so a
parameter can never leak out or permanently overwrite an unrelated variable
of the same name.

A procedure that takes exactly one parameter treats its call's entire value
as one literal piece of text, even if that text itself contains the word
"and" (`Do announce with Alex and Sam.` passes the single value
"Alex and Sam"). Only a call to a procedure that takes two or more
parameters splits its value list apart. Calling a parameterized procedure
without a value, or a parameterless procedure with a value, is reported as a
clear error rather than silently ignored. Because `with` introduces the
parameter list, avoid using the word "with" inside a procedure's own name
(for example, prefer "handle problems" over "deal with problems") so the
name and parameter list can't be confused.

A call's value isn't limited to a plain number or piece of text — it can
also be the name of a list variable, in which case the parameter receives
the whole list, not just its display text, and can be looped over with its
own For each, measured with `the number of items in ...`, or indexed with
`item N in ...` inside the procedure's body, exactly like any other list
variable:

```text
To sum with numbers, the total is 0 and then for each n in numbers, the total is total plus n

The scores is a list of 10, 20 and 30.
Do sum with scores.
```

A call's value can likewise be `item N in <list>` or `the first/last item
in <list>` directly, passing just that one item rather than the whole list.

**A procedure can return a value**, by having its own body set a variable
literally named `result` (`The result is ...`), and a caller can use that
value directly, without a separate `Do ... with ...` sentence: **`the result
of <name>`** (for a parameterless procedure) or **`the result of <name> with
<args>`** works anywhere an assignment's value or a call's own argument can
go:

```text
To double with n, the result is n times 2

The doubled is the result of double with 5.
Set the text of message to doubled
```

A call written this way can itself be nested as another call's own argument
(`the result of triple with the result of double with 5`), and it
temporarily shadows an outer variable also named `result` the same way a
parameter is shadowed — restoring it once the call finishes — so it never
leaks or clobbers an unrelated variable of the same name. Calling a
procedure that never sets `the result`, an undefined procedure name, the
wrong number of values, or a procedure that (directly or indirectly) calls
itself this way are all reported as the same clear errors an ordinary `Do
...` call already reports. Using a procedure this way only takes its final
`result` — any elements its own instructions would otherwise add to the page
are not added, since there's nowhere for them to go inside an expression;
its effects on other variables (including list mutations) still apply
normally.

`the result of <name>` can also be used directly on either side of an If
condition, with any comparator that already applies to the value it returns
— a number result supports all six comparators, a text result the same six
(with ordering ones alphabetical), and both sides of the comparison can use
it at once:

```text
To double with n, the result is n times 2

If the result of double with 5 is greater than 5, display the text "bigger".
```

A variable's value, number or text, can be used anywhere a plain instruction ends
with `to <name>`, such as `Set the text of points line to total points`. That
same trailing spot also accepts an arithmetic chain, such as
`Set the text of message to a plus b plus c`, which is what lets a
multi-parameter procedure combine its parameters directly.

A `The ... is ...` variable sentence can also be used as the instruction
inside an If, a For each, or a procedure's own body — not just on its own
line at the top level. This is what lets a loop keep a running total across
its iterations, or a procedure update a variable that outlives the call:

```text
The total is 0.
For each amount in 1, 2 and 3, the total is total plus amount.
Set the text of message to total
```

That runs the assignment once per item, in order, leaving `total` at `6`
once the loop finishes.

Like the rest of the language, none of this is case sensitive: keywords
(`the`, `is`, `if`, `otherwise`, `for each`, `in`, `and then`, `to`, `do`),
comparators, variable names, procedure names, and text comparisons all match
regardless of capitalization, so `THE SCORE IS 5` and `the score is 5` behave
identically.

If a line is close to one of these sentence shapes but has a spelling mistake
(a misspelled keyword, connector word, or comparator, or a variable name that is
one letter off from one defined earlier), the compiler reports it as a typo
with a one-click "Change ... to ..." fix, the same as it does for element,
style, and attribute names elsewhere in the page grammar. Typo fixes are always
offered, never applied silently.

**Current limits, stated plainly:**
- Text variables can be compared with all six ordering/equality comparators —
  `equal to`, `not equal to`, `greater than`, `less than`, `at least`,
  `at most` — with the ordering ones comparing alphabetically (plain
  code-point order, not locale-aware alphabetization, and case-insensitive)
  — plus three substring comparators and their negations, `contains`/`does
  not contain`, `starts with`/`does not start with`, and `ends with`/`does
  not end with`. Text still can't be used in arithmetic, though; it has its
  own `joined with` chain for concatenation, which is string-building only,
  not arithmetic. A list variable, unlike a plain text variable, can still
  only be compared with `equal to`, `not equal to`, `contains`, or `does
  not contain` (ordering a whole list doesn't make sense, `starts with`/
  `ends with` don't apply to a whole list, and `contains` on a list checks
  item membership, not a substring, since a list has no single string to
  search).
- There's no real boolean type: `true` and `false` are just literal text.
  The bare `If the <name>, ...` / `If not the <name>, ...` shorthand only
  reads a variable as true/false when it's a number (non-zero is true) or
  its text is exactly `true` or `false` — any other text (e.g. a name) is
  reported as a clear error rather than guessed at, since there's no
  general notion of "truthy" text in this language. Compare it with the
  ordinary `is equal to ...` form instead.
- `the result of <name>` / `the result of <name> with <args>` can be used
  as a whole assignment value, a whole call argument, or on either side of
  an If condition — but it still can't be combined with an arithmetic/text
  `joined with` chain in the same phrase (`the result of double with 5 plus
  1` reads as one call, `double with "5 plus 1"` evaluated as one number,
  not `(the result of double with 5) plus 1`), for the same reason a call's
  own single-parameter argument already reads to the end of the line:
  assign the result to a variable first, then use that variable in the
  chain. The same applies to `the uppercase of ...` / `the lowercase of ...`
  as a call argument: it works fine on its own (`Do shout with the
  uppercase of name.`), but can't be followed by a `joined with` chain in
  the same argument — assign the converted text to a variable first if you
  need to join it with something else before passing it.
- A list variable can be looped over, displayed, copied, measured with
  `the number of items in ...`, read one item at a time by position with
  `item N in ...` / `the first item in ...` / `the last item in ...`, and
  have one item changed in place with `Set item N in ... to ...`. A whole
  list can also be passed as a procedure's argument — a single-parameter
  call passes its one argument through untouched, list and all
  (`Do count items with favorite colors.`), and the parameter can then be
  looped over with its own For each, measured, or indexed, exactly the same
  as any other list variable. A procedure with two or more parameters can
  take a list as any one of them too, as long as the argument list's other
  values don't themselves need commas or "and" to separate them (the same
  word-splitting rule a For each's own inline list already follows).
- `the sum of <list>`, `the average of <list>`, `the highest of <list>` and
  `the lowest of <list>` only work when every item in the list is a plain
  number — a list with even one non-numeric item reports a clear error
  rather than silently treating that item as zero (or skipping it), and
  asking for any of these on a variable that isn't a list at all is likewise
  a clear error, not a silent fallback to literal text. `the sum of` an
  empty list is `0`; `the average of`, `the highest of`, and `the lowest of`
  an empty list have no numeric result (there's nothing to divide by or
  compare), so each is also reported as a clear error.
- `the rounded value of <number>` only accepts a single numeric operand —
  a plain number, a numeric variable, `the length of ...`, or a list
  aggregate (`the sum/average/highest/lowest of ...`) — not a whole
  arithmetic chain of its own (`the rounded value of 10 divided by 3` isn't
  supported; assign `10 divided by 3` to a variable first, then round that
  variable). Rounding something that isn't a number at all — text, or a
  variable that was never given a value — is a clear error, not a silent
  fallback to literal text.
- Inside a For each's own repeated instruction, the loop word is replaced
  with each item's literal text everywhere it's used to build a
  differently-named element (`For each opponent in ..., add a list item
  called result opponent inside fixtures`) — but it's also bound as a real
  variable for that same iteration, so it can be compared directly in a
  nested If condition too (`For each color in red, green and blue, if the
  color is equal to green, ...`), including inside a compound `and`/`or`
  condition, and even in the same instruction as a differently-named
  element (`if the color is equal to green, add a list item called swatch
  color inside colors`). A numeric loop (`For each amount in 1, 9 and 10,
  ...` or a counting loop like `For each round from 1 to 5, ...`) compares
  as a real number, not alphabetically, when used this way. This recognition
  only applies when the loop word is the condition's whole subject on its
  own (`if the color is ...`) — if it's part of a longer subject phrase
  (`if the favorite color is ...`), the loop word inside it is still
  replaced literally, the same as everywhere else in the instruction.
- A parenthesis-free `a list of ...` value is recognized by its exact
  leading words, the same way `joined with` and the arithmetic operator
  words are — so a piece of literal text that itself happens to start with
  the words "a list of" (e.g. `The blurb is a list of chores I did.`) would
  be misread as a list definition instead of literal text; quote it to force
  literal text, the same workaround used for any other keyword collision.
- A procedure's parameters can only be used the same way a variable can —
  a parameter can't be used to build a different element name per call (for
  example, a procedure can't add a differently-named element on each call
  just from its parameter). Combine a procedure with the loop's own
  instruction — which *can* vary per item — for the parts that need to
  change each time.
- A procedure's parameter *definition* list must be joined with `and` only
  (`To add with a and b, ...`) — a comma there would be indistinguishable
  from the comma that starts the procedure's body. A *call*'s value list has
  no such restriction and may use either `and` or a comma-and-`and` list.
- Chaining an If sentence's own instruction with `and then` into a second,
  independent If sentence nests the second one-line-deep: it only runs when
  the *first* If's condition is true, even when the second condition doesn't
  depend on the first at all. This is deliberate, consistent behavior (not
  an inconsistency) — it's how a single line always reads as "do this, then,
  if still applicable, do that" — but it means two truly independent If
  checks should be put on separate lines rather than joined with `and then`.
- A compound If condition's clauses must all be joined with the same
  connector (`and` only, or `or` only) — mixing both in one line is reported
  as a clear error rather than guessed at, since this language deliberately
  has no operator precedence rule to fall back on. Also, splitting a
  compound condition into clauses only happens right before a literal "the",
  so an ordinary text value is always safe to contain a bare "and" or "or"
  — but in the rare case where the words right after it happen to read like
  a whole new condition too (e.g. "...equal to Red and the score is equal to
  1"), it will be split into two clauses instead of read as one long text
  value (quoting the text does not prevent this, since the split happens
  before quotes are interpreted); rephrase the text to avoid that exact
  pattern if it happens.
- The, If, Otherwise, For each, To, and Do sentences on this page are
  compile-time only: they compute a value once, when the page is compiled,
  not in response to anything a visitor does afterward. Real runtime
  interactivity does now exist in the language, but as its own separate, much
  smaller sentence — see **`When the <button> is clicked, ...`** under
  "Native behavior and current limits" below — rather than as part of these
  variables.

See `examples/season-scoreboard.visual.intent` for a complete, working file.

## Single-text scene grammar and behavior

- One English instruction per line. Keywords ignore case. Quotes, escape
  characters, and code punctuation are not required. Blank lines are ignored.
- Exactly one `Show` or `Display` instruction supplies the text. Write your text
  directly after it, as in `Show Hello, world!`. The text preserves case, Unicode,
  punctuation, quotation marks inside the text, and backslashes literally. It is
  never spell-corrected. Blank text and text longer than 2000 characters are rejected.
- For a list of lines, write `Show the words THINK, BUILD and MOVE on separate lines`.
  Items can be separated by commas, `and`, or both. Multiword items stay together:
  `Show FIRST STEP, NEXT STEP and LAST STEP on separate lines`.
  Optional quotation can group phrases containing a comma or `and`.
- Layout is also a separate composable operation: `Show THINK BUILD MOVE` followed
  by `Put each word on a new line` has the same output as the list example.
  `Put each word on a separate line` and `Put each word on its own line` are
  equivalent. `Put the text on one line` joins the text with spaces.
  A layout instruction can appear before or after the display instruction.
- `Make the text <color>.` and `Make the background <color>.` accept:
  black, white, red, orange, yellow, green, blue, purple, pink, gray, grey,
  teal, navy, light blue, light gray. These are fixed palette values, not arbitrary CSS.
- `Make the text <size>.` accepts small (24px), medium (40px), large (64px),
  huge (96px), or an integer from 12 to 160 followed by `pixels`.
- Modifiers compose with `and` or commas, in any order:
  `Make the text large, blue and bold.`
  Weight modifiers are `bold`, `regular`, and `not bold`; slant modifiers are
  `italic`, `upright`, and `not italic`. Underline modifiers are `underline`,
  `underlined`, `not underlined`, and `no underline`.
  For example, `Make the text large, bold, italic and underlined`.
  `Underline the text` or `Underline it` is equivalent to setting that style.
- `Display` is a synonym for `Show`; `Set` (optionally followed by `to` after
  the target) is a synonym for `Make`; `Slide` is a synonym for `Move`.
  The article `the` is optional before a target. For example,
  `Set text to large and bold.` and `Make the text bold and large.` are equivalent.
- `Place the text at the <position>.` accepts left, right, top, bottom, center.
  Left/right positions are vertically centered; top/bottom are horizontally centered.
  `in` can replace `at`, and `middle` is a synonym for `center`.
- `Move the text from <edge> to <opposite edge> over <duration> seconds.`
  accepts the four directions above and a decimal duration from 0.1 to 60.
  `second` is also accepted. Movement is linear, runs once, and holds the final
  position. It stays within the preview's padded stage; it is not an offscreen marquee.
- Movement controls position when present. If the operating system requests
  reduced motion, animation is disabled and the placement instruction is used.
- Duplicate instructions for the same property are errors, regardless of order.
  Change an existing line rather than appending another one.
- Defaults are blue text, a white background, medium size, regular upright text, centered placement,
  and no animation. Long text wraps within the stage.

Single-text scenes have no sequencing or loops. Use the page instructions above
for multiple elements, images, buttons, and standard properties. Neither mode
interprets unrestricted English. Diagnostics identify the
line, explain the error, and suggest supported syntax. Compilation is all-or-nothing.
Existing quoted-string programs and comments remain supported for compatibility;
the beginner examples and IDE guidance do not require them. Unquoted display text
keeps its final punctuation; other instructions accept an optional final period.

## Ambiguity and corrections

The IDE distinguishes three situations:

- **Ambiguous:** more than one supported meaning, or an unresolved reference.
  `Make the text normal.` offers regular weight, medium size, or upright slant.
  `Move the text across the screen over 5 seconds.` offers left-to-right or
  right-to-left movement, keeping the duration. If duration is omitted, each
  suggestion explicitly proposes 3 seconds; you can edit it.
  `Show Hello world on separate lines` asks whether to put each word on its own
  line or keep the phrase together, rather than inventing line boundaries.
- **Possible typo:** a close spelling match leads to a valid instruction.
  `Make the text larg and bold.` offers `Make the text large and bold.`
  Spelling suggestions allow one insertion, deletion, substitution, or adjacent
  letter swap per word. Candidate corrections are checked by the compiler.
  They do not rewrite display text, quoted or unquoted, or repair malformed quotes.
  If `Show` itself is misspelled, a correction changes only that verb.
- **Unsupported or invalid:** the language has no meaning for the request, or
  the request violates a constraint. `Make it dance.` does not get a guessed
  animation. The IDE explains the supported constructs instead.

`It` refers only to earlier mentioned targets, not to inferred objects. `Show`
mentions the text; an explicit styling instruction mentions its target. If both
text and background have been mentioned, `Make it blue.` needs a choice.
A text-only property such as bold can disambiguate the target. Before any
eligible target has been mentioned, the IDE asks for an explicit target.

Each suggestion shows the exact replacement English instructions. Clicking replaces only
that line and recompiles; until then the source is unchanged, preview is cleared,
and HTML download is disabled. Other errors, including duplicate assignments,
may still need fixing after a meaning is chosen. The interpreter does not try to
detect every ambiguity in unrestricted English; unsupported constructions remain
unsupported rather than being guessed.

## Command-line compilation

For a complete animated typography example, see
[`words-in-motion.visual.intent`](../examples/words-in-motion.visual.intent).
It uses compound styling, a contextual target, a dark background, and an
eight-second upward animation. Compile it with:

```powershell
node dist\src\cli.js visual examples\words-in-motion.visual.intent --output examples\words-in-motion.html --write
```

Open the resulting HTML file in your browser. Reload to replay; your operating
system's reduced-motion setting is respected. The generated page is standalone
and does not need Studio or a network connection.

Print generated HTML to standard output:

```powershell
npm run sample:visual
```

Compile a saved source file to a standalone page:

```powershell
npm run build
node dist\src\cli.js visual examples\hello-world.visual.intent --output hello-world.html --write
```

Output writing requires `--write`; overwriting additionally requires `--force`.
The visual command refuses to overwrite its input source. Without `--output`,
the command emits HTML to standard output. Invalid source exits with code 1 and
diagnostics; write-policy errors exit with code 2.

## Implementation

`compileEnglishSource` in `src/english.ts` is shared by the CLI and Studio endpoint.
It selects the scene or page grammar based on structural instructions, not
individual examples. `compileVisualSource` in `src/visual.ts` preserves the scene
compiler and existing output.
`src/visual-syntax.ts` tokenizes sentences and parses actions, targets, lists of
modifiers, placement, and movement into statement nodes. Semantic analysis
resolves references, validates properties, and diagnoses ambiguity. This is a
compositional grammar rather than a list of complete example sentences.
It produces either a `VisualProgram` plus generated HTML, or diagnostics with
no HTML. Rendering uses escaped text, fixed CSS values, and CSS keyframes.
Generated pages contain no scripts or network dependencies and use a
content-security policy that permits only the generated stylesheet hash.
Studio displays them in a sandboxed iframe with no script permissions.

`src/web-syntax.ts` parses page instructions. `src/web.ts` resolves names into
`PageProgram`, checks structure and references, validates values with CSS Tree,
and verifies browser-style HTML parsing with parse5 before rendering.
`src/web-catalogue.ts` supplies element aliases, attribute scope, policy, style
availability, and IDE discovery from pinned standards data. Page exports contain
no scripts, escape text/attributes and CSS raw-text delimiters, use generated
element IDs and a stylesheet hash, and restrict external resources to the
document's own origin, HTTPS, and supported image data.

`POST /api/visual/compile` accepts `{ "source": "..." }`, requires the same
origin and Studio CSRF token as the existing authoring endpoints, and does not
write source or output files. The playground limits source to 20000 characters.
Its requests go only to the local Studio server; none go to an AI provider.
