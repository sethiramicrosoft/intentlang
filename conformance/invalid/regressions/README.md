# Minimized Adversarial Regressions

When seeded fuzzing finds a failure, reduce it to the smallest source that still
reproduces the behavior and persist it here as a rule-linked conformance
fixture. Include the seed and case number in the fixture metadata or commit
message so the original generated case remains reproducible.
