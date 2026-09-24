# LaunchOps — Generated Snapshot

> **This directory is a read-only generated artifact snapshot.**
> Do not hand-edit these files. Re-generate from source if you need changes.

This application was generated deterministically from
[`../launch-ops.intent`](../launch-ops.intent). The source defines a
multi-role program-launch system with seven entities, ten relationships,
fourteen workflow actions, and ninety-five permissions.

## What is generated

| File | Layer | Description |
|---|---|---|
| `app.mjs` | Backend | Node.js server with authentication, authorization, CRUD/action routes, CSRF, idempotency, concurrency checks, and audit logging |
| `migration.sql` | Database | SQLite schema with seven domain tables, foreign keys, constraints, and unique indexes |
| `intentlang.manifest.json` | IR/Manifest | Complete typed application model and compiler fingerprint |
| `index.html` | Frontend | Login shell, account provisioning, entity navigation, dialogs, and embedded schema |
| `app.js` | Frontend | Permission-aware CRUD UI, relationship selectors, actions, conflict handling, and theme behavior |
| `styles.css` | Frontend | Responsive light/dark application styling |
| `package.json` | Runtime | Minimal generated Node.js package descriptor |

Runtime data, credentials, environment files, and installed dependencies are
not part of this snapshot.

## Regenerate

```powershell
node --import tsx src\cli.ts check examples\launch-ops.intent
node --import tsx src\cli.ts generate examples\launch-ops.intent `
  --output examples\launch-ops-generated --write --force
```

## Run safely

Use a separate live copy so the committed snapshot remains deterministic:

```powershell
Copy-Item -Recurse examples\launch-ops-generated examples\launch-ops-app
cd examples\launch-ops-app

$secure = Read-Host "Bootstrap password" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
$env:INTENTLANG_BOOTSTRAP_NAME = Read-Host "Administrator name"
$env:INTENTLANG_BOOTSTRAP_EMAIL = Read-Host "Administrator email"
$env:INTENTLANG_BOOTSTRAP_PASSWORD = $plain
node app.mjs
```

Open `http://127.0.0.1:3210`. Clear the environment variables after the
server starts, following the root README's safe-bootstrap guidance.

## Demonstrated scenario

The preserved screenshots show a real browser walkthrough:

1. An Administrator provisions Contributor and Executive accounts.
2. The Administrator creates a Program, Milestone, WorkItem, Risk, Decision,
   and Update connected through generated relationship selectors.
3. Workflow actions activate the program and milestone, start work, escalate
   the risk, and publish the update.
4. A Contributor creates owner-scoped work and sees only their own User record.
5. An Executive has a read-only portfolio view and approves the pending
   launch decision through a generated confirmation dialog.

The walkthrough completed with zero browser errors.
