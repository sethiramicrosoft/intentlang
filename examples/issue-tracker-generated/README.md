# Issue Tracker — Generated Snapshot

> **This directory is a read-only generated artifact snapshot.**
> Do not hand-edit these files. Re-generate from source if you need changes.

This snapshot was produced by the IntentLang compiler from
`../issue-tracker.intent` using the `intentlang generate` command.
It is committed so that readers can inspect every layer of the generated
full-stack application without needing to run the generator themselves.

## Artifact table

| File | Layer | Description |
|---|---|---|
| `app.mjs` | Backend | Node.js HTTP server — auth, CRUD routes, actions, sessions, CSRF, idempotency, audit |
| `migration.sql` | Database | SQLite DDL — domain tables, constraints, foreign keys, unique index |
| `intentlang.manifest.json` | IR/Manifest | Typed intermediate representation + SHA-256 fingerprint |
| `package.json` | Backend | Minimal runtime package descriptor (`node app.mjs`) |
| `index.html` | Frontend | HTML shell — login-only when logged out, app schema embedded |
| `app.js` | Frontend | Browser behavior — auth flow, entity nav, table, dialogs, actions, CSRF, idempotency |
| `styles.css` | Frontend | Clawpilot-style light/dark theme — CSS custom properties |

No `app.sqlite`, environment files, credentials, logs, or runtime data
are included. Those are intentionally excluded by `.gitignore`.

## How to regenerate

After cloning and building the repo:

```bash
# Check the source first
npm run example:issue-tracker:check

# Regenerate into a fresh directory (not this snapshot directory)
node dist/src/cli.js generate examples/issue-tracker.intent \
  --output examples/issue-tracker-app --write --force

# Or using the globally linked CLI:
intentlang generate examples/issue-tracker.intent \
  --output examples/issue-tracker-app --write --force
```

The snapshot in this directory should be identical to what the above
commands produce, because the compiler is deterministic: the same
source + compiler version → the same output files.

## How to run the generated app

```bash
cd examples/issue-tracker-app   # use a live copy, not this snapshot
npm install
```

Then set bootstrap environment variables (see root README for safe
input instructions) and start the server:

```bash
node app.mjs
```

Open `http://127.0.0.1:3210` in your browser.

## Further reading

Full beginner-friendly case study with line-by-line explanation,
pipeline diagram, runtime walkthrough, and FAQ:

→ [`../../docs/issue-tracker-full-stack.md`](../../docs/issue-tracker-full-stack.md)
