# Atlas Grid — Generated Snapshot

> **This directory is a read-only generated artifact snapshot.**
> Regenerate it from source instead of editing generated files.

This application was generated deterministically from
[`../atlas-grid.intent`](../atlas-grid.intent). It contains ten entities,
twenty-one relationships, eighteen workflow actions, five roles, and 155
expanded permissions.

## Generated layers

| File | Responsibility |
|---|---|
| `app.mjs` | Node.js authentication, authorization, CRUD, workflows, CSRF, idempotency, concurrency, and audit runtime |
| `migration.sql` | SQLite tables, constraints, foreign keys, and indexes |
| `intentlang.manifest.json` | Typed application model and semantic fingerprints |
| `intentlang.trace.json` | Source-to-schema/runtime/UI trace links |
| `intentlang.lock.json` | Deterministic generation dependency lock |
| `index.html` | Application and authentication shell |
| `app.js` | Permission-aware browser interactions |
| `styles.css` | Responsive generated visual system |

Runtime databases, environment files, credentials, and installed dependencies
are intentionally excluded.

## Regenerate

```powershell
node --import tsx src\cli.ts check examples\atlas-grid.intent
node --import tsx src\cli.ts generate examples\atlas-grid.intent `
  --output examples\atlas-grid-generated --write --force --allow-security-downgrade
```

Use a separate `examples\atlas-grid-app` directory for writable local data.

Read the [complete case study](../../docs/atlas-grid-full-stack.md).
