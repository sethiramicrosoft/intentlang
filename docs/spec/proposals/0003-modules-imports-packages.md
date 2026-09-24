# Proposal 0003: Modules, Imports, Namespaces, and Integrity

**Status**: Implemented, experimental language surface

## Goal

Allow large IntentLang applications to be split across files without changing
their canonical application meaning, hiding declarations, or weakening source
traceability.

## Syntax

Root file:

```intentlang
application LaunchOps
requires IntentLang 0.8
import "./launch-ops/entities.intent" as Entities
import "./launch-ops/workflows.intent" as Workflows
```

Imported file:

```intentlang
module LaunchOps.Entities
export all

a Program has a required name as text
```

## Semantics

- Import paths are relative to the importing file and must remain inside the
  root project directory.
- `requires IntentLang <major.minor>` is checked before semantic compilation.
- Every imported file declares one globally unique qualified module name.
- Imports are resolved depth first in source order.
- An import alias is unique within its importing file and names the imported
  module for navigation; aliases do not rewrite declarations.
- `export all` is explicit and currently the only export form.
- Import cycles, duplicate module names, duplicate aliases, missing module
  declarations, missing exports, path escapes, and unresolved files fail.
- The resolver emits one flattened source stream for the existing compiler and
  a line-level source map back to every contributing file.
- Dependency integrity is SHA-256 over normalized module contents. The build
  manifest fingerprints the sorted dependency map.

Canonical formatting still emits one fully expanded application. Modules have
no runtime authority and do not alter generated behavior.
