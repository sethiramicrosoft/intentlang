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

## License note

No repository license has been selected yet. Contributions are accepted with that current repository state.
