# Getting started

IntentLang currently requires a terminal and Node.js 24 or later.

## Install

```bash
git clone https://github.com/sethiramicrosoft/intentlang.git
cd intentlang
npm install
npm run check
npm test
npm run build
```

## Open Studio

```bash
npm run sample:studio
```

Studio uses `examples/todo.intent` and listens on
`http://127.0.0.1:3211`.

Studio presents three explicit authoring paths:

- **Code** opens the direct controlled-English IDE with autocomplete,
  diagnostics, formatting, the compiled application model, canonical source,
  and typed IR. Existing `.intent` files open here by default.
- **App Builder** guides beginners through a finite set of supported
  business-app descriptions, then shows the proposed IntentLang source for
  review before generation. See [Describe App mode](description-mode.md).
- **Visual Language** opens the separate page and interface language for
  HTML/CSS, forms, animation, and safe interactions. See the
  [visual language guide](visual-language.md).

The [Studio feature guide](studio.md) explains every workspace, toolbar action,
inspector panel, shortcut, and persistence boundary.

Try this in the wizard:

```text
I want to build an app that just allows users to add their name, age, address, DOB, then allow sorting
```

Studio identifies supported fields, reports that sorting is unsupported, and
requires acknowledgement before generating only the supported behavior. It
does not silently invent missing features.

## Use the compiler

The repository scripts exercise the included Todo example:

```bash
npm run sample:check
npm run sample:format
npm run sample:compile
npm run sample:generate
```

- `check` parses and validates source.
- `format` emits canonical controlled English.
- `compile` emits typed canonical IR.
- `generate` writes the UI, runtime, API, SQLite migration, manifest, and
  security controls.

## Run the generated Todo application

Authenticated applications require a first administrator. Do not place a
password directly in source, documentation, or shell history.

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

After the session:

```powershell
Remove-Item Env:INTENTLANG_BOOTSTRAP_NAME -ErrorAction SilentlyContinue
Remove-Item Env:INTENTLANG_BOOTSTRAP_EMAIL -ErrorAction SilentlyContinue
Remove-Item Env:INTENTLANG_BOOTSTRAP_PASSWORD -ErrorAction SilentlyContinue
```

### macOS or Linux

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

After the session:

```bash
unset INTENTLANG_BOOTSTRAP_NAME INTENTLANG_BOOTSTRAP_EMAIL INTENTLANG_BOOTSTRAP_PASSWORD
```

The generated server uses `http://127.0.0.1:3210` unless `PORT` is set.

## Next steps

- [Browse working examples](../examples/README.md)
- [Read the LaunchOps case study](launch-ops-full-stack.md)
- [Learn the visual language](visual-language.md)
- [Use the CLI reference](reference/cli.md)
- [Review current limitations](project/status.md)
