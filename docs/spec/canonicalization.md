# Canonicalization

IntentLang separates accepted authoring forms from canonical source and
canonical semantics.

For business programs, the parser first resolves shorthand and references into
`ProgramIr`. `formatSource` then emits one explicit source representation:

- derived IDs become explicit;
- roles always include IDs;
- entities, fields, relationships, actions, and permissions use their canonical
  statement forms;
- string literals use JSON escaping;
- line endings are LF; and
- output ends with exactly one newline.

Canonical formatting is idempotent:

```text
compile(format(compile(source))) == compile(source)
format(compile(format(compile(source)))) == format(compile(source))
```

Comments and author formatting are intentionally absent from canonical source
because they do not change program semantics. The original source remains the
authoring artifact; canonical source is the review and compatibility artifact.

Canonical semantic JSON recursively sorts object keys while preserving array
order. Array order remains significant because it can affect generated
presentation and deterministic artifact ordering.
