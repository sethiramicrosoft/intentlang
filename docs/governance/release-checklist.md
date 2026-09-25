# Language Release Checklist

## Constitution

- [ ] Every changed construct satisfies all applicable constitution principles.
- [ ] No unresolved ambiguity or hidden context is accepted.
- [ ] Security and semantic-correctness gates have not been waived.

## Specification and governance

- [ ] Every change has an approved proposal using the current template.
- [ ] Rule, inventory, diagnostic, IR, and obligation registries are synchronized.
- [ ] Canonical form, compatibility class, and migration behavior are reviewed.
- [ ] Experimental features are not described as stable.

## Evidence

- [ ] `npm run governance:check`
- [ ] `npm run check`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run conformance`
- [ ] `npm run test:adversarial:release`
- [ ] `npm run assurance:complete`
- [ ] Historical examples compile with reviewed semantic differences only.
- [ ] Cross-backend parity and traceability checks pass.

## Human and independent evidence

- [ ] Human-comprehension results exist for stable-graduation claims.
- [ ] Negative and null findings are published.
- [ ] Independent security and specification review is complete.
- [ ] All critical/high findings are resolved; accepted lower findings have
      documented owners and deadlines.

## Release record

- [ ] Release commit and artifacts are reproducible.
- [ ] Language, IR, compiler, generator, and dependency versions are recorded.
- [ ] Changelog distinguishes syntax, semantics, diagnostics, generators,
      migrations, and tooling.
- [ ] Rollback and incident contacts are documented.
