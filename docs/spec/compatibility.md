# Semantic Fingerprints and Compatibility

Generated manifests expose independent fingerprints:

- `sourceFingerprint`: SHA-256 of canonical IntentLang source.
- `semanticFingerprint`: SHA-256 of canonical typed IR.
- `dependencyFingerprint`: SHA-256 of the resolved dependency/version map.
- `artifactFingerprint`: SHA-256 of sorted artifact paths and content hashes.
- `generatorVersions`: explicit database, runtime, and UI generator versions.

`irFingerprint` remains as a compatibility alias of `semanticFingerprint`.

Compatibility classification is deterministic:

| Classification | Meaning | Review |
|---|---|---|
| `identical` | All fingerprints and generator versions match | No |
| `source-only` | Canonical source changed without typed semantic change | No |
| `dependency-change` | Resolved module/package dependencies changed | Required |
| `generator-change` | One or more artifact generators changed | Required |
| `semantic-change` | Typed program meaning changed | Required |

A semantic change is not automatically breaking: the migration planner and
future rule-specific compatibility policies determine whether it is additive,
destructive, or security-destructive. It must never pass silently.

Historical fixtures under `conformance/compatibility/` preserve representative
programs and expected comparisons. CI runs these fixtures and requires complete
rule coverage before accepting a language change.
