# IntentLang

![status](https://img.shields.io/badge/status-experimental-orange)
![node](https://img.shields.io/badge/node-%3E%3D24-339933)
![version](https://img.shields.io/badge/version-v0.8.0--alpha-blue)

**IntentLang is a deterministic controlled-English programming language for
building secure applications and interactive web pages.**

The English is the source code. A traditional compiler parses a published,
finite grammar and either generates software predictably or returns explicit
diagnostics. **No AI model is required.**

> [!WARNING]
> IntentLang `v0.8.0-alpha.0` is experimental. It is not production-ready or
> intended for sensitive data, and it intentionally rejects unsupported or
> ambiguous instructions.

## See it

[![LaunchOps Administrator view showing a generated program workflow](examples/launch-ops-admin.png)](docs/launch-ops-full-stack.md)

[`examples/launch-ops.intent`](examples/launch-ops.intent) generates an
authenticated program-launch system with:

- 7 entities and 31 business fields
- 10 relationships
- 14 guarded actions across 6 state machines
- 4 roles and 95 expanded, inspectable permissions
- REST APIs, SQLite, authentication, authorization, CSRF protection,
  idempotency, optimistic concurrency, and audit logging

**[Read the case study](docs/launch-ops-full-stack.md)** ·
**[Browse the English source](examples/launch-ops.intent)** ·
**[Explore more examples](examples/README.md)**

More generated full-stack systems:
**[Atlas Grid supply-chain control tower](docs/atlas-grid-full-stack.md)** ·
**[GridShield utility restoration command](docs/grid-shield-full-stack.md)**

## What the code looks like

```text
application Todo
authentication uses User identified by email

role Member

a User has a required name as text
a User has a required unique email as text length between 1 and 320
a Task has a required title as text length between 1 and 200
a Task has a done as boolean default false
each Task belongs to a User as owner on delete restrict

action complete a Task
  require done is false otherwise "Task is already complete"
  set done to true

allow Member to read User where self
allow Member to create Task with owner as self
allow Member to read Task where owner is self
allow Member to update Task where owner is self
allow Member to run complete on Task where owner is self
```

IntentLang compiles supported business requirements into a typed application
model, then generates the browser UI, Node.js backend, REST API, SQLite schema,
authorization checks, workflows, and audit controls.

```text
Controlled English
       ↓
Parser + validation
       ↓
Typed application model
       ↓
UI + API + database + security controls
```

IntentLang also includes an experimental visual/page language:

```text
Show Hello, world!
Make the text large, blue and bold
Make the background white
Move the text from left to right over 3 seconds
```

See the [visual language guide](docs/visual-language.md) and
[example gallery](examples/README.md).

## Try it

Requires Node.js 24+.

```bash
git clone https://github.com/sethiramicrosoft/intentlang.git
cd intentlang
npm install
npm run sample:studio
```

Open `http://127.0.0.1:3211` if Studio does not open automatically.

To inspect the compiler pipeline from the command line:

```bash
npm run sample:check
npm run sample:format
npm run sample:compile
npm run sample:generate
```

See [Getting started](docs/getting-started.md) for installation, generated-app
startup, and safe account bootstrap instructions.

## What works today

- Deterministic parsing, formatting, compilation, and generation
- Business entities, relationships, validation, roles, scoped permissions,
  policies, workflows, and state machines
- Exact decimals, money, dates, typed functions, records, collections, and
  authorization-aware queries
- Transactions, rollback, idempotency, typed external contracts, bounded
  retries/timeouts, and capability-scoped escape hatches
- Modules, imports, namespaces, dependency locks, and semantic compatibility
- Studio, App Builder wizard, LSP, REPL, debugger, conformance runner, semantic
  manifest validator, and backend parity checker
- Visual pages with validated HTML/CSS, forms, layout, and safe interactions

This is **controlled English**, not arbitrary natural-language programming.
Unsupported meaning is rejected rather than guessed. See
[Project status and limitations](docs/project/status.md).

## Documentation

| Goal | Read |
|---|---|
| Install and run IntentLang | [Getting started](docs/getting-started.md) |
| Learn the business language | [Business language specification](docs/spec/business-core.md) |
| Build visual pages | [Visual language guide](docs/visual-language.md) |
| Use Studio and the App Builder | [Describe App mode](docs/description-mode.md) |
| Review the flagship application | [LaunchOps case study](docs/launch-ops-full-stack.md) |
| Review another generated full-stack app | [Issue Tracker case study](docs/issue-tracker-full-stack.md) |
| Look up commands | [CLI reference](docs/reference/cli.md) |
| Understand safety and limitations | [Project status and limitations](docs/project/status.md) |
| Report or evaluate a vulnerability | [Security policy](SECURITY.md) |
| Inspect formal language assurance | [Normative specification index](docs/spec/index.md) |
| Review language-change requirements | [Language governance](docs/spec/language-governance.md) |
| Contribute | [Contributing guide](CONTRIBUTING.md) |

The complete categorized list is in the
[documentation index](docs/README.md), but every primary path is linked
directly above.

## Project status

IntentLang is currently `v0.8.0-alpha.0`. Generated applications are for
experimentation and evaluation, not production deployment.

No software license has been selected yet. Reuse rights are not granted beyond
GitHub's viewing and forking terms.
