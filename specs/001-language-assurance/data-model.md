# Data Model: Language Assurance

## NormativeRule

- `id`: stable identifier
- `languageVersion`: introduced version
- `status`: experimental | stable | deprecated | removed
- `title`
- `syntax`
- `semantics`
- `nameResolution`
- `evaluationOrder`
- `canonicalForm`
- `diagnostics`
- `runtimeObligations`
- `securityObligations`
- `compatibilityClass`
- `evidenceLinks`

## CanonicalProgram

- `languageVersion`
- `modules`
- `canonicalSource`
- `sourceFingerprint`
- `semanticFingerprint`
- `dependencyFingerprint`
- `ruleIds`
- `traceMap`

## IntentProposal

- `input`
- `extractedConcepts`
- `unresolvedQuestions`
- `unsupportedCapabilities`
- `canonicalDiff`
- `semanticExplanation`
- `securityExplanation`
- `validationResult`
- `reviewState`
- `confirmationRecord`

## Clarification

- `id`
- `question`
- `reason`
- `answerType`
- `allowedAnswers`
- `securityImpact`
- `selectedAnswer`
- `sourceEffect`

## Module

- `name`
- `version`
- `namespace`
- `imports`
- `exports`
- `sourceFiles`
- `fingerprint`
- `resolvedSymbols`

## Policy

- `name`
- `parameters`
- `appliesToEntities`
- `authoredRules`
- `expandedPermissions`
- `sourceSpans`

## TraceLink

- `sourceSpan`
- `ruleId`
- `irNodeId`
- `artifactKind`
- `artifactLocation`
- `runtimeObligation`
- `testIds`

## ConformanceFixture

- `id`
- `ruleIds`
- `category`
- `input`
- `languageVersion`
- `expectedCanonicalSource`
- `expectedDiagnostics`
- `expectedSemanticFingerprint`
- `expectedRuntimeAssertions`

## CompatibilityBaseline

- `release`
- `sources`
- `canonicalOutputs`
- `semanticFingerprints`
- `schemaContracts`
- `routeContracts`
- `permissionContracts`
- `workflowContracts`

## StudyResult

- `studyId`
- `cohort`
- `taskId`
- `correctness`
- `confidence`
- `duration`
- `defects`
- `securityDefects`
- `retentionResult`
- `anonymizedNotes`
