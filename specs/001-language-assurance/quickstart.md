# Quickstart: First Assurance Increment

The first implementation increment establishes proof infrastructure without
changing stable language semantics.

## Target

1. Inventory current accepted constructs.
2. Assign normative rule IDs.
3. Create initial rule registry schema.
4. Add conformance fixture loader.
5. Add canonical and semantic fingerprint baselines.
6. Report rule-to-test coverage.

## Validation

```powershell
npm run check
npm test
npm run test:browser
node --import tsx src\cli.ts check examples\launch-ops.intent
```

The increment is successful when all current tests pass and the assurance report
shows every inventoried stable construct with a rule ID and at least one
baseline fixture.
