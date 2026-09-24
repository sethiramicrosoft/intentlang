# Modules and Packages

## MODULE-COMPOSITION-001

An IntentLang project may compose one application from explicitly imported
files:

```intentlang
import "./launch-ops-modules/core.intent" as Core
import "./launch-ops-modules/entities.intent" as Entities
```

The project may close its compiler context explicitly:

```intentlang
requires IntentLang 0.8
```

An incompatible major/minor requirement is rejected before semantic
compilation.

Every imported file declares a globally unique qualified module name and
explicitly exports its declarations:

```intentlang
module LaunchOps.Entities
export all
```

Imports resolve depth first in source order and may not escape the entry file's
directory. Aliases are unique within one importing file. Cycles, unresolved
files, duplicate qualified names, duplicate aliases, missing module
declarations, and missing exports are errors.

The resolver flattens the graph into the existing canonical compiler input
while retaining a line-level source map. Diagnostics and generated trace links
therefore identify the contributing module file and original line.

Each imported module receives a SHA-256 integrity value. The sorted dependency
map contributes to `dependencyFingerprint` independently from the semantic
fingerprint. `intentlang check <entry> --write-lock` writes a reviewed lock;
later compilation fails if module contents drift from that lock.
