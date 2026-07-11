# IntentLang

![status](https://img.shields.io/badge/status-experimental-orange)
![node](https://img.shields.io/badge/node-%3E%3D24-339933)
![version](https://img.shields.io/badge/version-v0.6.0--alpha-blue)

**Tagline:** An experimental offline, no-AI compiler designed to help non-software developers build applications using controlled natural English.

> [!WARNING]
> IntentLang v0.6.0-alpha.0 is experimental software. It is not production-ready, not security-audited by an independent third party, and intentionally rejects many inputs.

## Table of Contents

1. [What this project is](#what-this-project-is)
2. [Why this exists](#why-this-exists)
3. [How it works (pipeline)](#how-it-works-pipeline)
4. [IntentLang Studio alpha](#intentlang-studio-alpha)
5. [**Proof: a complete full-stack app generated without AI**](#proof-a-complete-full-stack-app-generated-without-ai)
6. [What v0.6.0-alpha can do](#what-v060-alpha-can-do)
7. [Current limitations](#current-limitations)
8. [Prerequisites (beginner-friendly)](#prerequisites-beginner-friendly)
9. [Install from GitHub](#install-from-github)
10. [Five-minute quick start](#five-minute-quick-start)
11. [Safe bootstrap and run (no credential literals)](#safe-bootstrap-and-run-no-credential-literals)
12. [Browser walkthrough](#browser-walkthrough)
13. [Language tutorial](#language-tutorial)
14. [Additional example: issue tracker](#additional-example-issue-tracker)
15. [CLI reference](#cli-reference)
16. [Generated artifacts reference](#generated-artifacts-reference)
17. [Safety model deep dive](#safety-model-deep-dive)
18. [Data and migration guidance](#data-and-migration-guidance)
19. [Project structure](#project-structure)
20. [Development guide](#development-guide)
21. [Troubleshooting](#troubleshooting)
22. [Security and privacy](#security-and-privacy)
23. [Roadmap (non-binding)](#roadmap-non-binding)
24. [FAQ](#faq)
25. [Contributing and governance](#contributing-and-governance)
26. [Repository topics](#repository-topics)

## What this project is

IntentLang is a **controlled natural language** (CNL) for defining secure local CRUD-style business apps.

- **Controlled natural language** = fixed phrases with strict grammar.
- **Not unrestricted natural language** = you cannot write arbitrary English and expect it to “figure it out.”
- **Offline compiler/runtime** = no AI model calls are required for compile or runtime behavior.
- **No AI tokens** = compiling, checking, formatting, generating, and running applications does not consume model tokens or require an AI subscription.
- **Designed for non-software developers** = the long-term goal is to let domain experts describe supported applications without learning a conventional general-purpose programming language.
- **Current domain focus** = local-first line-of-business apps backed by SQLite, Node.js, and a generated browser UI.

> [!IMPORTANT]
> The purpose of IntentLang is not merely to make source code look friendlier. The goal is to create a downloadable programming language that can deterministically translate controlled natural English into working applications without contacting an AI service at any stage.

IntentLang is intended to make application building:

- **More accessible:** people can express supported data, rules, permissions, and workflows in readable English-like statements.
- **Predictable in cost:** there is no per-prompt, per-token, or per-generation AI charge.
- **Private and offline-capable:** application descriptions do not need to be sent to an external model provider.
- **Deterministic:** the same valid source and compiler version produce the same typed representation and generated artifacts.
- **Auditable:** the compiler follows published grammar and rules rather than making probabilistic interpretations.

This is the project’s direction, not a claim that v0.5.0 has already made software development effortless for every non-developer. The current release still requires installing Node.js, using a terminal, and learning IntentLang’s restricted grammar. Improving that experience is a central part of the roadmap.

## Why this exists

AI-assisted application builders can be remarkably productive, but they introduce tradeoffs that are undesirable for some people and organizations:

- They may consume paid tokens every time an application is created, changed, regenerated, or debugged.
- They may require a network connection and an account with an AI provider.
- Private business requirements may need to be sent to an external service.
- The same request may be interpreted differently between runs, prompts, or model versions.
- Important requirements can be omitted because the model was never explicitly asked about retries, permissions, concurrency, or failure behavior.
- Users may receive code they cannot confidently inspect, reproduce, or maintain without continuing to use AI.

IntentLang explores a different model:

```text
Controlled natural English
        ↓
Deterministic compiler
        ↓
Typed intermediate representation
        ↓
Generated application
```

There is no model inference in that pipeline and therefore no AI token consumption. The compiler does not attempt to “understand anything you meant.” It accepts a finite grammar, validates it, and rejects unsupported or ambiguous statements with diagnostics.

This gives up the flexibility of unrestricted conversation in exchange for repeatability, offline operation, predictable cost, and stronger guarantees.

“Vibe coding” and guessy generators can also fail in subtle ways (retries, duplicate submissions, ownership leaks, edge-case auth bugs). IntentLang tries to reduce those risks with a deterministic approach:

- Reject invalid input instead of guessing.
- Use a typed IR (intermediate representation) as a contract between parser, planner, runtime, and UI.
- Emit deterministic artifacts so the same source gives the same output.
- Keep traditional systems underneath (TypeScript/Node/SQLite/browser) so behavior is inspectable and testable.

IntentLang does **not** eliminate traditional languages internally. It lets users work at a higher, English-like level while the compiler and runtime use TypeScript, Node.js, SQL, HTML, CSS, and JavaScript underneath.

## How it works (pipeline)

```mermaid
flowchart LR
  A[.intent source] --> B[Parser]
  B --> C[Typed IR]
  C --> D[Obligation + type checks]
  D --> E[Schema/runtime/UI generation]
  E --> F[SQLite + Node server + Browser UI]
```

Text fallback:

1. Read `.intent` source.
2. Parse strict grammar into typed IR.
3. Validate obligations (types, ids, permissions, auth constraints).
4. Generate SQL migration + runtime server + UI assets.
5. Run locally with Node + SQLite + browser.

## IntentLang Studio alpha

**IntentLang Studio** is a local, dependency-free browser-based authoring environment for `.intent` source files. It is the signature feature of v0.6.0-alpha.

- **100% offline** — the Studio server runs on your machine and binds to `127.0.0.1` only. No traffic leaves your computer.
- **No AI tokens** — Studio is a deterministic compiler front-end. Checking, formatting, and generating never contacts an AI model.
- **No credentials required to run Studio** — Studio is an authoring tool and does not handle application login credentials.

### Starting Studio

```bash
# Against the built-in Todo example:
npm run sample:studio

# Or, after npm link or npm install -g:
intentlang studio examples/todo.intent

# Against the Issue Tracker example:
intentlang studio examples/issue-tracker.intent

# Custom port (or set PORT= environment variable):
intentlang studio myapp.intent --port 4000

# Headless / CI (no browser auto-open):
intentlang studio myapp.intent --no-open
```

Studio opens at `http://127.0.0.1:3211` (default port) in your default browser.

### Studio walkthrough

**Editor panel (left)**

- Type or paste IntentLang source into the editor.
- After a short pause, the source is automatically checked and diagnostics appear in the Problems panel.
- **Check** — manual compile run.
- **Format** — shows a diff preview before replacing your text.
- **Save** — confirms before writing to the original source file (atomic rename).
- **Generate App** — shows a plan (with warnings for destructive or security-breaking changes), then confirms before writing artifacts to the sibling `<basename>-app/` directory.
- **Keyboard shortcuts:** `Ctrl+S` / `Cmd+S` = Save, `Ctrl+Shift+F` / `Cmd+Shift+F` = Format.

**Output panels (right)**

| Panel | What you see |
|---|---|
| **Problems** | Diagnostics with error code, line/column, message, fix hint. Click a diagnostic to jump to the source line. |
| **Application Model** | Human-friendly summary: auth, entities/fields, relationships, actions, permission matrix, safety summary. |
| **Canonical Source** | Formatted canonical syntax with all stable IDs visible (read-only). |
| **Raw IR** | The typed intermediate representation as JSON (collapsible). |

**Templates**

Click **Templates ▾** to load a built-in example (Todo or Issue Tracker). Studio warns you about unsaved changes before replacing the editor.

**Theme**

Click the 🌙 / ☀️ button in the header to toggle dark/light mode. The choice is saved in `localStorage`.

**Generate App next steps**

After a successful generation, Studio shows:

```
Generated in: /path/to/myapp-app/

Artifacts:
  app.mjs
  migration.sql
  intentlang.manifest.json
  package.json
  index.html
  app.js
  styles.css

Next steps:
  cd myapp-app
  npm install
  node app.mjs
```

If authentication is enabled, Studio lists the **environment variable names** you must set — never the values.

### Studio security model

- Binds to `127.0.0.1` only (loopback). Not accessible from other machines.
- Same-origin protection: validates `Origin` and `Host` headers on every state-changing endpoint.
- Ephemeral in-memory CSRF token: generated at startup, delivered in the initial `/api/state` response, validated on every POST. Never written to disk or logs.
- Anti-TOCTOU plan token: generating an app requires a short-lived token tied to the exact source fingerprint from the plan step. Changed source invalidates the token.
- Destructive and security-downgrade migrations are refused in the browser UI. Use the CLI flags if you need them.
- No arbitrary filesystem access from browser requests. The source file path is resolved once at startup.
- Request body capped at 1 MB.
- All responses carry `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and other security headers.

### npx / npm link beginner guide

If you cloned the repo and want to use `intentlang` as a global command:

```bash
# Inside the repo:
npm run build
npm link

# Then from anywhere:
intentlang studio myapp.intent
```

Or run without installing globally:

```bash
node /path/to/intentlang/dist/src/cli.js studio myapp.intent
```

## Proof: a complete full-stack app generated without AI

> **One `.intent` file. No model inference. No API calls. No tokens.
> A complete running web application.**

The `examples/issue-tracker.intent` source file (44 lines of controlled
English) was fed to the IntentLang compiler. The compiler produced
seven artifacts — backend, frontend, and database — with no AI
involvement at any stage. No generated file was hand-edited to make
the proof pass.

### What was generated

| Layer | File | What it does |
|---|---|---|
| **Backend** | [`examples/issue-tracker-generated/app.mjs`](examples/issue-tracker-generated/app.mjs) | Node.js HTTP server: auth, CRUD, actions, sessions, CSRF, idempotency, audit |
| **Frontend** | [`examples/issue-tracker-generated/app.js`](examples/issue-tracker-generated/app.js) | Browser behavior: login, entity nav, tables, forms, dialogs, CSRF, idempotency |
| **Frontend** | [`examples/issue-tracker-generated/index.html`](examples/issue-tracker-generated/index.html) | HTML shell with embedded app schema |
| **Frontend** | [`examples/issue-tracker-generated/styles.css`](examples/issue-tracker-generated/styles.css) | Clawpilot light/dark CSS theme |
| **Database** | [`examples/issue-tracker-generated/migration.sql`](examples/issue-tracker-generated/migration.sql) | SQLite DDL: tables, constraints, foreign keys, unique index |
| **IR** | [`examples/issue-tracker-generated/intentlang.manifest.json`](examples/issue-tracker-generated/intentlang.manifest.json) | Full typed IR + SHA-256 fingerprint |
| **Backend** | [`examples/issue-tracker-generated/package.json`](examples/issue-tracker-generated/package.json) | Minimal runtime descriptor |

### What was proved

- **No AI.** Zero model inference, API calls, subscriptions, or tokens
  at any stage: checking, generation, or runtime.
- **No hand-editing.** The snapshot in `examples/issue-tracker-generated/`
  is raw compiler output. No file was manually modified after generation.
- **Deterministic.** The same source + compiler version produce the same
  artifacts. Run the generate command yourself to verify.
- **Runnable.** The generated app passed an end-to-end walkthrough:
  admin bootstrap, member provisioning, ticket create/edit/start/close,
  ownership enforcement, isolation between members, idempotency replay,
  version-conflict detection, and audit log verification.

### Open the Issue Tracker in Studio

```bash
npm run build
node dist/src/cli.js studio examples/issue-tracker.intent
```

Studio opens at `http://127.0.0.1:3211`. Click **Generate App** to
reproduce the snapshot.

### Generate and run (command line)

```bash
node dist/src/cli.js generate examples/issue-tracker.intent \
  --output examples/issue-tracker-app --write --force
cd examples/issue-tracker-app && npm install
# Set bootstrap env vars (see Safe bootstrap section), then:
node app.mjs
```

### Full case study

→ **[`docs/issue-tracker-full-stack.md`](docs/issue-tracker-full-stack.md)**

Beginner-friendly, line-by-line explanation of the source, the exact
pipeline, every generated file, safe bootstrap instructions for Windows
and macOS/Linux, backend/frontend/database excerpts, a complete runtime
walkthrough, a Mermaid diagram, and a reproduction checklist.

---

## What v0.6.0-alpha can do

### Language/compiler

- Applications, entities, fields, defaults.
- Field types: `text`, `integer`, `boolean`.
- Field modifiers: `required`, `unique` (canonical order matters).
- Text length constraints (`length between X and Y`).
- Relationships: `belongs to`, with `on delete restrict|cascade` (parser rejects `set null` in current belongs-to form).
- Actions with strict body:
  - `require <field> <operator> <literal> otherwise "message"`
  - `set <field> to <literal>`
- Precondition operators: `is`, `is not`, `is greater than`, `is at least`, `is less than`, `is at most`.

### Auth/permissions/runtime

- `authentication uses <IdentityEntity> identified by <required unique text field>`.
- Roles.
- Default-deny permissions.
- Permission scopes:
  - `where self` (identity entity reads)
  - `where owner is self`
  - `with owner as self` (force-owner create)
- Provisioning route support (`allow <Role> to provision accounts`).
- Password hashing via `scrypt`.
- Session cookies (`HttpOnly`, `SameSite=Strict`, 8-hour max age).
- Session token hashing and CSRF token hashing at rest.
- CSRF validation + same-origin mutation guard.
- Login rate limiting.
- Generic invalid-credential responses.
- Idempotency-key support for create/action/provision flows.
- Optimistic concurrency (`expectedVersion`, 409 conflict).
- Audit logging with secret-like key stripping.
- Deterministic manifest + IR fingerprint persistence.
- Migration/security plan checks (`--allow-data-loss`, `--allow-security-downgrade`).
- Generated Clawpilot-style light/dark UI assets.

### Generated CRUD shape

- List/read/create/update endpoints are generated.
- Safe delete endpoint is **not** generated in v0.5.0.

## Current limitations

- Not arbitrary English.
- No OAuth, MFA, password reset, or email verification.
- No safe delete/archive workflow yet.
- No PostgreSQL backend yet.
- No multi-process/distributed production model yet.
- No cloud deployment story in this repo.
- Rate limit is in-process memory (single process model).
- Uses Node `node:sqlite` (still experimental in Node ecosystem).
- Generated apps bind to localhost by default.
- Security posture is defense-in-depth oriented but not independently audited.
- Richer computed expressions/money/date/enums are not part of current grammar.

## Prerequisites (beginner-friendly)

- **OS:** Windows, macOS, or Linux.
- **Node.js:** 24+.
- **Terminal:** text-based command window.
  - Windows: PowerShell
  - macOS/Linux: Terminal

Check tools:

```bash
node -v
npm -v
```

Expected: version numbers print.

Basic folder navigation:

- Windows PowerShell:
  - `Get-Location` (show current folder)
  - `Get-ChildItem` (list files)
  - `cd <folder>` (enter folder)
- macOS/Linux:
  - `pwd`
  - `ls`
  - `cd <folder>`

## Install from GitHub

```bash
git clone https://github.com/sethiramicrosoft/intentlang.git
cd intentlang
npm install
npm run check
npm test
npm run build
```

What each command does:

- `git clone ...`: downloads the project.
- `cd intentlang`: enters the project folder.
- `npm install`: installs dependencies.
- `npm run check`: TypeScript compile check (no output files).
- `npm test`: test suite (includes DLP test).
- `npm run build`: compile source with `tsconfig.build.json` (tests excluded).

## Five-minute quick start

Use the included example file `examples/todo.intent`:

```bash
npm run sample:check
npm run sample:format
npm run sample:compile
npm run sample:generate
```

Conceptually:

- **Compile** → produces canonical typed IR (`.json`) from intent source.
- **Generate** → emits runnable app artifacts (runtime + UI + SQL + manifest).

## Safe bootstrap and run (no credential literals)

Never place passwords directly into command history.

### Windows PowerShell

```powershell
$secure = Read-Host "Enter bootstrap password" -AsSecureString
$BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
$env:INTENTLANG_BOOTSTRAP_NAME = Read-Host "Bootstrap display name"
$env:INTENTLANG_BOOTSTRAP_EMAIL = Read-Host "Bootstrap email"
$env:INTENTLANG_BOOTSTRAP_PASSWORD = $plain
npm run sample:serve
```

Cleanup after startup/session:

```powershell
Remove-Item Env:INTENTLANG_BOOTSTRAP_NAME -ErrorAction SilentlyContinue
Remove-Item Env:INTENTLANG_BOOTSTRAP_EMAIL -ErrorAction SilentlyContinue
Remove-Item Env:INTENTLANG_BOOTSTRAP_PASSWORD -ErrorAction SilentlyContinue
```

### macOS/Linux

Use a silent prompt so the value is not echoed:

```bash
read -r -p "Bootstrap display name: " INTENTLANG_BOOTSTRAP_NAME
read -r -p "Bootstrap email: " INTENTLANG_BOOTSTRAP_EMAIL
read -r -s -p "Bootstrap password: " INTENTLANG_BOOTSTRAP_PASSWORD
printf "\n"
export INTENTLANG_BOOTSTRAP_NAME
export INTENTLANG_BOOTSTRAP_EMAIL
export INTENTLANG_BOOTSTRAP_PASSWORD
npm run sample:serve
```

Cleanup:

```bash
unset INTENTLANG_BOOTSTRAP_NAME INTENTLANG_BOOTSTRAP_EMAIL INTENTLANG_BOOTSTRAP_PASSWORD
```

Notes:

- On first run with auth enabled, bootstrap env vars create the first admin account.
- Once accounts exist, startup ignores empty bootstrap vars.

## Browser walkthrough

Default generated server URL: `http://127.0.0.1:3210` (unless `PORT` set).

Typical flow:

1. Open app URL in browser.
2. Log in with provisioned account.
3. See identity + role in header.
4. Create task(s), edit task(s), run `complete` action.
5. Ownership scoping hides other users’ records.
6. Logout invalidates session.

Server is stopped by default; start it with `npm run sample:serve`.

## Language tutorial

### Complete Todo source (v0.5.0-compatible)

```intent
application Todo
authentication uses User identified by email

role Administrator
role Member

a User has a required name as text
a User has a required unique email as text length between 1 and 320
a Task has a required title as text length between 1 and 200
a Task has a done as boolean default false
each Task belongs to a User as owner on delete restrict

action complete a Task
  require done is false otherwise "Task is already complete"
  set done to true

allow Administrator to create User
allow Administrator to read User
allow Administrator to update User
allow Administrator to provision accounts
allow Administrator to read Task where owner is self
allow Administrator to create Task with owner as self
allow Administrator to update Task where owner is self
allow Administrator to run complete on Task where owner is self
allow Member to read User where self
allow Member to read Task where owner is self
allow Member to create Task with owner as self
allow Member to update Task where owner is self
allow Member to run complete on Task where owner is self
```

### Line-by-line explanation

- `application Todo` → app name; id is derived (`todo`) in natural form.
- `authentication ...` → declares identity model.
- `role ...` → declares named access roles.
- `a User has ...` / `a Task has ...` → natural field declarations.
- `required unique` order is canonical; changing order causes diagnostics.
- `length between` is valid only on text fields.
- `belongs to ... as owner` creates required FK ownership relation.
- `action ...` block requires both `require` and `set` lines.
- `allow ...` rules are explicit; default is deny.

### Grammar notes (exact phrases)

Key declarations accepted in v0.5:

- `application Name with id stable-id` or natural `application Name`
- `entity Name with id stable-id`
- fields: `  field is [required ][unique ](text|integer|boolean) with id stable-id ...`
- natural field: `a|an Entity has a|an [required ][unique ]field as type ...`
- relationship explicit:
  - `Entity belongs to Entity as rel with id rel-id on delete restrict|cascade|set null`
  - parser currently rejects `set null` for belongs-to semantics.
- natural relationship:
  - `each Entity belongs to a|an Entity as rel on delete ...`
- action header:
  - `action verb a|an Entity [with id stable-id]`
- action body:
  - `  require field <op> <literal> otherwise "message"`
  - `  set field to <literal>`
- permissions:
  - `allow Role to create|read|update Entity`
  - `allow Role to read Entity where self`
  - `allow Role to read|update Entity where owner is self`
  - `allow Role to create Entity with owner as self`
  - `allow Role to run action on Entity [where owner is self]`
  - `allow Role to provision accounts`

Compiler diagnostics are intentional and precise; invalid or ambiguous inputs are rejected.

## Additional example: issue tracker

The `examples/issue-tracker.intent` file is a reference application that exercises:

- `authentication` with User identity.
- `Administrator` and `Member` roles.
- Three entities: `User`, `Project`, `Ticket`.
- `Ticket` with title, description, status text field (default `"open"`).
- `Ticket` belongs to both `Project` (cascade delete) and `User` owner (restrict).
- Two actions: `start` (open → in-progress) and `close` (not-closed → closed).
- Admin: unscoped access to all entities and actions.
- Member: self-read on User, unscoped read on Project, owner-scoped read/create/update/actions on Ticket.

Check and inspect the issue tracker:

```bash
intentlang check examples/issue-tracker.intent
```

Open it in Studio:

```bash
intentlang studio examples/issue-tracker.intent
```

Generate the app:

```bash
intentlang generate examples/issue-tracker.intent --output issue-tracker-app --write
cd issue-tracker-app && npm install
# Set bootstrap env vars, then:
node app.mjs
```

Source preview:

```intent
application IssueTracker
authentication uses User identified by email

role Administrator
role Member

a User has a required name as text
a User has a required unique email as text length between 1 and 320
a Project has a required name as text
a Ticket has a required title as text length between 1 and 200
a Ticket has a description as text
a Ticket has a status as text default "open"

each Ticket belongs to a Project as project on delete cascade
each Ticket belongs to a User as owner on delete restrict

action start a Ticket
  require status is "open" otherwise "Ticket is not open"
  set status to "in-progress"

action close a Ticket
  require status is not "closed" otherwise "Ticket is already closed"
  set status to "closed"

allow Administrator to provision accounts
allow Administrator to create User
allow Administrator to read User
allow Administrator to update User
allow Administrator to create Project
allow Administrator to read Project
allow Administrator to update Project
allow Administrator to create Ticket
allow Administrator to read Ticket
allow Administrator to update Ticket
allow Administrator to run start on Ticket
allow Administrator to run close on Ticket
allow Member to read User where self
allow Member to read Project
allow Member to create Ticket with owner as self
allow Member to read Ticket where owner is self
allow Member to update Ticket where owner is self
allow Member to run start on Ticket where owner is self
allow Member to run close on Ticket where owner is self
```

## CLI reference

| Command | Purpose | Notes |
|---|---|---|
| `intentlang check <source>` | Parse + validate + print summary | Exit 0 on success, 1 on diagnostics |
| `intentlang format <source>` | Canonical formatter | `--write` overwrites source; `--output ... --write` writes elsewhere |
| `intentlang compile <source>` | Emit canonical IR JSON | `--output ... --write` required for file write; `--force` required for overwrite |
| `intentlang generate <source>` | Plan/generate app artifacts | Requires `--output`; use `--write` to materialize |
| `intentlang studio <source>` | Open local authoring Studio | Default port 3211; `--port N` or `PORT=N`; `--no-open` to suppress browser |

Generation safety flags:

- `--allow-data-loss`: required when destructive migration detected.
- `--allow-security-downgrade`: required for security-destructive plan changes.

NPM scripts in this repo:

- `npm run check`
- `npm test`
- `npm run build`
- `npm run sample:check`
- `npm run sample:studio` (Studio against todo.intent, headless)
- `npm run example:issue-tracker:check`
- `npm run sample:format`
- `npm run sample:compile`
- `npm run sample:generate`
- `npm run sample:serve`

## Generated artifacts reference

Generated app directory includes:

- `app.mjs` (Node runtime server)
- `migration.sql` (SQLite schema/migration SQL)
- `intentlang.manifest.json` (deterministic manifest + fingerprint)
- `package.json` (generated app runtime package metadata)
- `index.html` (UI shell)
- `app.js` (UI behavior)
- `styles.css` (UI styles)
- `app.sqlite` (runtime DB, local data; should be ignored)

Regeneration model:

- Generated artifacts are treated as outputs.
- Re-run generate after source changes.
- Review schema/security plan messages before forcing changes.

## Safety model deep dive

### Enforced by construction

- Stable IDs in IR.
- Deterministic canonical JSON and manifest fingerprint.
- Explicit permission model (no implicit allow).

### Enforced by compile-time checks

- Grammar correctness and strict phrase matching.
- Type checks for defaults/preconditions/assignments.
- Action obligation checks (requires both preconditions and assignments).
- Authentication + role + allow-rule consistency.

### Enforced by runtime checks

- Default-deny authorization.
- Ownership/self scope filtering in SQL and record checks.
- Hidden 404 for unauthorized single-record/action access.
- Idempotency key replay protection.
- Optimistic concurrency checks.
- Transaction boundaries around critical mutations.
- CSRF + same-origin checks for mutation routes.
- Password/session/csrf hash handling at rest.
- Audit redaction of sensitive keys.

### Important caveats (not fully provable here)

- No independent security audit yet.
- Single-process assumptions for in-memory rate limiting.
- Operational hardening and deployment architecture are out of current scope.

## Data and migration guidance

- Initial DB is SQLite (`app.sqlite`) generated/managed locally.
- `migration.sql` is generated from the current IR.
- DB and backup files are intentionally ignored by git.
- Migration planner flags destructive/security-sensitive changes.
- Do not auto-apply destructive/security downgrade changes blindly.
- Keep backups and test migration paths before real data upgrades.

## Project structure

```text
intentlang/
├─ examples/
│  ├─ todo.intent
│  └─ todo.ir.json
├─ src/
│  ├─ cli.ts
│  ├─ compiler.ts
│  ├─ formatter.ts
│  ├─ generator.ts
│  ├─ manifest.ts
│  ├─ model.ts
│  ├─ parser.ts
│  ├─ planner.ts
│  ├─ runtime-codegen.ts
│  └─ ui-codegen.ts
├─ test/
│  ├─ compiler.test.ts
│  ├─ dlp.test.ts
│  └─ e2e.test.ts
├─ package.json
├─ tsconfig.json
└─ tsconfig.build.json
```

(Generated folders and local runtime artifacts are intentionally excluded here.)

## Development guide

- TypeScript strict workflows: run `npm run check` before commit.
- Run full tests (`npm test`) before publishing changes.
- Build output comes from `npm run build` using `tsconfig.build.json` with tests excluded.
- When changing grammar, update parser + formatter + compiler tests + runtime/UI behavior as needed.
- Keep codegen deterministic; avoid random ordering.
- Avoid broad silent catches; preserve explicit failures.
- Follow DLP policy: do not store credential literals in tests or docs.

## Troubleshooting

- **Wrong Node version:** install Node 24+.
- **Port 3210 in use:** set `PORT` env var to a different value.
- **Bootstrap vars missing:** runtime exits with explicit first-account message.
- **Invalid credentials:** login intentionally returns generic `INVALID_CREDENTIALS`.
- **403 mutation errors:** check Origin and CSRF headers.
- **Schema/security generation refusal:** review migration/security plan; use force flags only intentionally.
- **DLP test failure:** remove any saved credential literals.
- **Stale browser assets:** hard refresh the page.
- **SQLite experimental notices:** expected with current Node sqlite module maturity.
- **Windows path quirks:** prefer quoting paths with spaces.

## Security and privacy

See [SECURITY.md](./SECURITY.md).

Rules of thumb:

- Never post secrets in issues/PRs.
- Keep vulnerability reports minimal and private-aware.
- Do not commit credential samples, tokens, or local user data.

## Roadmap (non-binding)

- **v0.6:** safe delete/archive patterns.
- **v0.7:** search/filter/pagination.
- Future exploration: richer types, calculations, workflows, modules, LSP tooling, PostgreSQL, and deployment guidance.

This roadmap is directional, not a promise.

## FAQ

**Is this AI?**

No. The compiler and generated runtime are deterministic and local. They do not call a language model.

**Does IntentLang consume AI tokens?**

No. You can check, format, compile, regenerate, and run an IntentLang application without purchasing or consuming AI tokens.

**Why use natural English if there is no AI interpreting it?**

IntentLang uses a deliberately limited form of English with published grammar. A traditional parser can interpret those accepted phrases exactly, just as an ordinary compiler interprets programming-language syntax.

**Is IntentLang intended for people who are not software developers?**

Yes—that is the primary long-term purpose. Domain experts should eventually be able to describe supported applications in readable statements without learning Python, TypeScript, or SQL. The current experimental release still requires terminal use and learning the controlled grammar, so more usability work remains.

**Can I write normal English?**  
No. You must use IntentLang’s fixed grammar.

**Is generated app production-ready?**  
Not yet. v0.5.0 is experimental.

**Should I edit generated files directly?**  
Generally no. Regenerate from `.intent` source.

**Where is my data stored?**  
In local SQLite (`app.sqlite`) in the generated app directory.

**Why no delete yet?**  
Safe deletion semantics are not finalized in v0.5.0.

**Why explicit IDs?**  
For stability and deterministic migration/permission mapping.

**Why are permissions explicit?**  
To keep access control reviewable and default-deny.

**Can this replace Python/TypeScript?**  
No. It targets a narrow app-generation problem.

## Contributing and governance

- Contribution process: see [CONTRIBUTING.md](./CONTRIBUTING.md).
- Security process: see [SECURITY.md](./SECURITY.md).
- Current version/status: **v0.5.0 experimental**.
- **License note:** No software license has been selected yet. Reuse rights are therefore not granted beyond GitHub’s viewing/forking terms. Repository owner can add a license later.

## Repository topics

Suggested topics for this repository:

- `programming-language`
- `compiler`
- `dsl`
- `controlled-natural-language`
- `natural-language-programming`
- `code-generation`
- `typescript`
- `nodejs`
- `sqlite`
- `application-generator`
- `low-code`
- `offline-first`
- `deterministic-builds`
- `security`
- `experimental`
