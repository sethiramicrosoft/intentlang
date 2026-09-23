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
blocks new windows and submissions. Creating a button does not create a click
handler or backend service.

Script, inline event-handler, arbitrary stylesheet, embedded-document, template,
shadow-DOM, canvas-drawing, SVG/MathML, named page-animation, and backend features
are not implemented. The compiler manages the HTML document shell and security
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
Set the text of points line to total points

If the total points is at least 40, set the text of form line to Promotion form and then set the text of banner to Well played.
Otherwise, set the text of form line to Steady form.

For each opponent in Ashford Town, Bellmoor United and Castlebridge, add a list item called result opponent inside fixtures
```

- **`The <name> is <value>.`** defines or recomputes a variable. The value can be
  a plain number, an existing variable, or one arithmetic step: `plus`, `minus`,
  `times`, or `divided by` another number or variable. Each sentence performs at
  most one operation; chain several sentences for anything larger, the same way
  the rest of the language favors clear, repeated instructions over dense syntax.
  A value can also be plain text, either bare words (`The winner is Alex
  Carter.`) or a quoted phrase (`The motto is "Play as a team".`) — quotes are
  only needed if the text itself could be confused with a number or another
  variable's name.
- **`If the <name> is <comparison> <value>, <one or more instructions>.`** keeps
  its instruction(s) only when the comparison is true. Comparisons are written
  as words: `greater than`, `less than`, `equal to`, `not equal to`, `at least`,
  `at most`. Text variables can only be compared with `equal to` or
  `not equal to` (the ordering comparators don't make sense for text); using
  another comparator on text is reported as a clear error.
- **`Otherwise, <one or more instructions>.`** runs when the If sentence right
  before it was false.
- **`For each <name> in <item, item and item>, <one or more instructions>.`**
  repeats its instruction(s) once per item, replacing the loop word wherever
  it appears. When there's more than one instruction, every instruction runs
  for one item before moving to the next, so an element you add can be
  referenced by a later instruction for that same item.

An If, Otherwise, or For each sentence can carry several instructions by
joining them with **`and then`**, for example:
`If the score is at least 40, set the text of form line to Promotion form and then set the text of banner to Well played.`
Plain `and` is never treated as a chain separator (so it stays safe to use
inside ordinary text or a For each list) — only the exact phrase `and then`
splits a sentence into multiple instructions.

A variable's value, number or text, can be used anywhere a plain instruction ends
with `to <name>`, such as `Set the text of points line to total points`.

Like the rest of the language, none of this is case sensitive: keywords
(`the`, `is`, `if`, `otherwise`, `for each`, `in`, `and then`), comparators,
variable names, and text comparisons all match regardless of capitalization,
so `THE SCORE IS 5` and `the score is 5` behave identically.

If a line is close to one of these sentence shapes but has a spelling mistake
(a misspelled keyword, connector word, or comparator, or a variable name that is
one letter off from one defined earlier), the compiler reports it as a typo
with a one-click "Change ... to ..." fix, the same as it does for element,
style, and attribute names elsewhere in the page grammar. Typo fixes are always
offered, never applied silently.

**Current limits, stated plainly:**
- No nested If inside If, or For each inside For each, yet — each sentence's
  instructions must be ordinary page instructions, not another If/Otherwise/
  For each sentence.
- Text variables can only be compared with `equal to` or `not equal to`;
  there's no ordering (`greater than`, etc.) for text, and text can't be used
  in arithmetic.
- This is compile-time only. A page can react to what a variable's value was when
  you compiled it, not to anything a visitor does afterward; there is still no
  generated JavaScript. Runtime interactivity (state that changes after a click)
  is a deliberate, larger design decision that hasn't been made yet.

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
