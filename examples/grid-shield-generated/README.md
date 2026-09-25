# GridShield — Generated Snapshot

> **This directory is a read-only generated artifact snapshot.**
> Regenerate it from source instead of editing generated files.

This application was generated deterministically from
[`../grid-shield.intent`](../grid-shield.intent). It contains eleven entities,
twenty-three relationships, twenty-four workflow actions, five roles, and 171
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
node --import tsx src\cli.ts check examples\grid-shield.intent
node --import tsx src\cli.ts generate examples\grid-shield.intent `
  --output examples\grid-shield-generated --write --force --allow-security-downgrade
```

Use a separate `examples\grid-shield-app` directory for writable local data.

Read the [complete case study](../../docs/grid-shield-full-stack.md).
