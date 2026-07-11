# IntentLang

![status](https://img.shields.io/badge/status-experimental-orange)
![node](https://img.shields.io/badge/node-%3E%3D24-339933)
![version](https://img.shields.io/badge/version-v0.5.0-blue)

**Tagline:** An experimental offline, no-AI compiler designed to help non-software developers build applications using controlled natural English.

> [!WARNING]
> IntentLang v0.5.0 is experimental software. It is not production-ready, not security-audited by an independent third party, and intentionally rejects many inputs.

## Table of Contents

1. [What this project is](#what-this-project-is)
2. [Why this exists](#why-this-exists)
3. [How it works (pipeline)](#how-it-works-pipeline)
4. [What v0.5.0 can do](#what-v050-can-do)
5. [Current limitations](#current-limitations)
6. [Prerequisites (beginner-friendly)](#prerequisites-beginner-friendly)
7. [Install from GitHub](#install-from-github)
8. [Five-minute quick start](#five-minute-quick-start)
9. [Safe bootstrap and run (no credential literals)](#safe-bootstrap-and-run-no-credential-literals)
10. [Browser walkthrough](#browser-walkthrough)
11. [Language tutorial](#language-tutorial)
12. [Additional example: ticket tracker](#additional-example-ticket-tracker)
13. [CLI reference](#cli-reference)
14. [Generated artifacts reference](#generated-artifacts-reference)
15. [Safety model deep dive](#safety-model-deep-dive)
16. [Data and migration guidance](#data-and-migration-guidance)
17. [Project structure](#project-structure)
18. [Development guide](#development-guide)
19. [Troubleshooting](#troubleshooting)
20. [Security and privacy](#security-and-privacy)
21. [Roadmap (non-binding)](#roadmap-non-binding)
22. [FAQ](#faq)
23. [Contributing and governance](#contributing-and-governance)
24. [Repository topics](#repository-topics)

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

## What v0.5.0 can do

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

## Additional example: ticket tracker

```intent
application WorkTracker
authentication uses User identified by email

role Administrator
role Member

a User has a required name as text
a User has a required unique email as text length between 1 and 320
a Project has a required title as text length between 1 and 120
a Ticket has a required summary as text length between 1 and 240
a Ticket has a status as text default "open"
a Ticket has a priority as integer default 1
a Ticket has a closed as boolean default false

each Ticket belongs to a User as owner on delete restrict
each Ticket belongs to a Project as project on delete restrict

action close a Ticket
  require closed is false otherwise "Ticket is already closed"
  set closed to true

action raisepriority a Ticket
  require priority is less than 5 otherwise "Priority is already at maximum"
  set priority to 5

allow Administrator to create User
allow Administrator to read User
allow Administrator to update User
allow Administrator to create Project
allow Administrator to read Project
allow Administrator to update Project
allow Administrator to create Ticket with owner as self
allow Administrator to read Ticket where owner is self
allow Administrator to update Ticket where owner is self
allow Administrator to run close on Ticket where owner is self
allow Administrator to run raisepriority on Ticket where owner is self
allow Administrator to provision accounts

allow Member to read User where self
allow Member to create Ticket with owner as self
allow Member to read Ticket where owner is self
allow Member to update Ticket where owner is self
allow Member to run close on Ticket where owner is self
allow Member to run raisepriority on Ticket where owner is self
```

## CLI reference

| Command | Purpose | Notes |
|---|---|---|
| `intentlang check <source>` | Parse + validate + print summary | Exit 0 on success, 1 on diagnostics |
| `intentlang format <source>` | Canonical formatter | `--write` overwrites source; `--output ... --write` writes elsewhere |
| `intentlang compile <source>` | Emit canonical IR JSON | `--output ... --write` required for file write; `--force` required for overwrite |
| `intentlang generate <source>` | Plan/generate app artifacts | Requires `--output`; use `--write` to materialize |

Generation safety flags:

- `--allow-data-loss`: required when destructive migration detected.
- `--allow-security-downgrade`: required for security-destructive plan changes.

NPM scripts in this repo:

- `npm run check`
- `npm test`
- `npm run build`
- `npm run sample:check`
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
