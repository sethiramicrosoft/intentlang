# Contributing to IntentLang

Thank you for helping improve IntentLang.

## Before you start

- Read `README.md` for project scope and limitations.
- Read `SECURITY.md` for vulnerability handling.
- Do not commit secrets, credentials, or private data.

## Local setup

```bash
git clone https://github.com/sethiramicrosoft/intentlang.git
cd intentlang
npm install
npm run check
npm test
npm run build
```

Node.js 24 or newer is required. To start Studio without opening a browser:

```bash
npm run sample:studio
```

Open `http://127.0.0.1:3211`. Stopping a preview or closing Studio through its
server API waits for the preview process to exit before returning, so generated
files can be replaced or removed on Windows.

## Issue workflow

When opening an issue, include:

- Problem statement
- Expected behavior
- Actual behavior
- Reproduction steps
- Environment (OS, Node version)

Avoid posting any secrets or user-private data.

## Pull request workflow

1. Create a branch from `main`.
2. Keep PRs focused and small where possible.
3. Run checks before opening PR:
   - `npm run check`
   - `npm test`
   - `npm run build`
4. Explain what changed and why.
5. Link the issue the PR addresses.

## Determinism and DLP rules

- Preserve deterministic ordering in parser/codegen/manifests.
- Do not add non-deterministic outputs without clear need.
- DLP policy is strict:
  - never save credential literals in tests/docs/code,
  - generate auth inputs at runtime in tests,
  - keep local DB/output artifacts ignored.

## Code style expectations

- TypeScript strictness should remain green.
- Prefer explicit errors and diagnostics over broad silent catches.
- Keep grammar/IR/runtime/UI behavior aligned.

## Grammar change checklist

If you change grammar or language semantics, update all relevant layers:

- Parser rules and diagnostics
- IR model where needed
- Formatter canonical output
- Runtime code generation (if behavior changes)
- UI generation (if user flow changes)
- Compiler/unit/e2e tests
- README language/tutorial sections

## Tests

Run the full suite locally before requesting review:

```bash
npm test
```

The visual playground also has real-browser coverage for styling, all four
animation directions at desktop/tablet/mobile sizes, reduced motion, diagnostics,
and standalone HTML export. Page coverage also checks named/nested elements,
native controls, catalogue insertion, and all advertised element types in Chromium:

```bash
npx playwright install chromium
npm run test:browser
```

Playwright is a development dependency only. Neither generated visual pages nor
the compiler need a browser automation package at runtime.

The page compiler uses pinned `@vscode/web-custom-data`, `css-tree`, and `parse5`
runtime dependencies. When updating standards data or capability policy, update
the explicit coverage counts in `test/web.test.ts` and the language documentation.
Every available element must compile with its structural example and survive real
browser parsing. Every available CSS property must pass the shared validator.
Do not mark a capability available merely because the dataset contains its name.
User-controlled script execution and form submission remain unsupported.

## License note

No repository license has been selected yet. Contributions are accepted with that current repository state.
