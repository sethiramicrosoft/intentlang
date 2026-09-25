# CLI reference

After `npm run build`, invoke the CLI through the compiled binary or install it
locally with `npm link`.

| Command | Purpose |
|---|---|
| `intentlang check <source>` | Parse and validate source |
| `intentlang format <source>` | Emit canonical controlled English |
| `intentlang compile <source>` | Emit canonical typed IR |
| `intentlang generate <source>` | Plan and generate application artifacts |
| `intentlang studio <source>` | Open the local authoring Studio |
| `intentlang lsp` | Start the stdio language server |
| `intentlang tooling <source>` | Inspect diagnostics, symbols, actions, tokens, and traces |
| `intentlang repl expression "<expression>"` | Evaluate an exact typed expression |
| `intentlang repl query <query.json>` | Evaluate an authorization-aware query |
| `intentlang debug <source> --request <request.json>` | Explain authorization and workflow decisions |
| `intentlang conformance run` | Run standalone conformance fixtures |
| `intentlang manifest validate <manifest.json>` | Validate semantic and artifact fingerprints |
| `intentlang parity <source>` | Verify database, runtime, and UI obligations |

## Common options

- `--write` materializes formatter, compiler, or generator output.
- `--output <path>` selects an output file or directory.
- `--force` permits overwriting an existing generated target.
- `--allow-data-loss` acknowledges a destructive migration.
- `--allow-security-downgrade` acknowledges a security-destructive plan.
- `studio --port <number>` changes the Studio port.
- `studio --no-open` starts Studio without opening a browser.
- `conformance run --category <category>` filters fixture categories.
- `conformance run --rule <rule-id>` filters fixtures by normative rule.

## Repository shortcuts

```bash
npm run sample:check
npm run sample:format
npm run sample:compile
npm run sample:generate
npm run sample:studio
npm run sample:serve
```

## Tooling examples

```bash
intentlang repl query examples/authorized-query-repl.json
intentlang debug examples/todo.intent --request examples/todo-debug-request.json
intentlang manifest validate examples/launch-ops-generated/intentlang.manifest.json
intentlang parity examples/launch-ops.intent
```

Generated applications normally contain:

- `app.mjs`
- `migration.sql`
- `intentlang.manifest.json`
- `package.json`
- `index.html`
- `app.js`
- `styles.css`
- local `app.sqlite` runtime data

Treat generated files as outputs. Change `.intent` source and regenerate rather
than maintaining generated application code by hand.
