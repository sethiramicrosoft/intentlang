# Focus Board — Generated Snapshot

> **This directory is a read-only generated artifact snapshot.**
> Do not hand-edit these files. Re-generate from source if you need changes.

This snapshot was produced by the IntentLang compiler from
`../focus-board.intent` using the `intentlang generate` command.
It is committed so that readers can inspect every layer of the generated
full-stack application without needing to run the generator themselves.

## Artifact table

| File | Layer | Description |
|---|---|---|
| `app.mjs` | Backend | Node.js HTTP server — CRUD routes, actions, CSRF, idempotency, audit |
| `migration.sql` | Database | SQLite DDL — the `Task` table and its constraints |
| `intentlang.manifest.json` | IR/Manifest | Typed intermediate representation + SHA-256 fingerprint |
| `package.json` | Backend | Minimal runtime package descriptor (`node app.mjs`) |
| `index.html` | Frontend | HTML shell with the app schema embedded |
| `app.js` | Frontend | Browser behavior — entity nav, table, dialogs, actions, CSRF, idempotency |
| `styles.css` | Frontend | Light/dark theme — CSS custom properties |

No `app.sqlite`, environment files, credentials, logs, or runtime data
are included. Those are intentionally excluded by `.gitignore`.

## How to regenerate

After cloning and building the repo:

```powershell
node --import tsx src\cli.ts generate examples\focus-board.intent `
  --output examples\focus-board-app --write --force
```

The snapshot in this directory should be identical to what the above
command produces, because the compiler is deterministic: the same
source + compiler version → the same output files.

## How to run the generated app

```powershell
cd examples\focus-board-app   # use a live copy, not this snapshot
npm install
node app.mjs
```

## The paired click-runtime page

`../focus-board.visual.intent` compiles to `../focus-board.html`, a static
page that reads and writes real `Task` records at this backend's `/tasks`
endpoint using the click language (`list ... into ...`,
`create a record at ... with ...`). Together, the two source files show
both IntentLang pipelines — entity/CRUD generation and page-behavior
generation — driving the same backend from one small English program.
