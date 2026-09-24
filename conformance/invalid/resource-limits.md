# Resource-limit corpus

The adversarial property suite constructs boundary cases rather than storing
multi-megabyte fixtures:

- page source at or below 20,000 characters must be processed normally;
- page source above 20,000 characters must fail with `W001`;
- a 50,000-character unknown business statement must fail without throwing;
- all generated inputs must complete within the test-runner budget.

The exact deterministic cases live in `test/properties.test.ts`; any failure is
minimized into `conformance/invalid/regressions/`.
