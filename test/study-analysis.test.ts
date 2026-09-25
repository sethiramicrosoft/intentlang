import assert from "node:assert/strict";
import test from "node:test";
import { analyzeStudyResults } from "../src/language/study-analysis.js";

test("study analysis publishes cohort and representation aggregates without identities", () => {
  const aggregates = analyzeStudyResults([
    {
      studyVersion: "1.0.0",
      participantCode: "PILOT-A1",
      cohort: "developer",
      experienceBand: "4-to-10-years",
      assignmentGroup: "A",
      responses: [
        {
          taskId: "authorization-scope",
          phase: "initial",
          representation: "intentlang",
          correctnessScore: 3,
          maximumScore: 3,
          durationSeconds: 45,
          confidence: 5,
          introducedDefects: 0,
          securityRiskOpportunities: 1,
          securityRisksIdentified: 1,
          excludedFromTiming: false
        },
        {
          taskId: "authorization-scope-retention",
          phase: "retention",
          representation: "intentlang",
          correctnessScore: 2,
          maximumScore: 3,
          durationSeconds: 0,
          confidence: 4,
          introducedDefects: 0,
          securityRiskOpportunities: 0,
          securityRisksIdentified: 0,
          excludedFromTiming: true
        }
      ]
    },
    {
      studyVersion: "1.0.0",
      participantCode: "PILOT-B1",
      cohort: "developer",
      experienceBand: "4-to-10-years",
      assignmentGroup: "B",
      responses: [
        {
          taskId: "authorization-scope",
          phase: "initial",
          representation: "typescript",
          correctnessScore: 2,
          maximumScore: 3,
          durationSeconds: 60,
          confidence: 5,
          introducedDefects: 1,
          securityRiskOpportunities: 1,
          securityRisksIdentified: 0,
          excludedFromTiming: false
        }
      ]
    }
  ]);
  assert.equal(aggregates.length, 2);
  assert.equal(aggregates[0]?.cohort, "developer");
  assert.equal(JSON.stringify(aggregates).includes("PILOT-A1"), false);
  assert.equal(
    aggregates.find((item) => item.representation === "typescript")?.defectRate,
    1
  );
  assert.equal(
    aggregates.find((item) => item.representation === "intentlang")
      ?.meanRetentionCorrectness,
    2 / 3
  );
  assert.equal(
    aggregates.find((item) => item.representation === "intentlang")
      ?.securityRiskDetectionRate,
    1
  );
});

test("study analysis rejects duplicate participants and invalid scores", () => {
  const result = {
    studyVersion: "1.0.0",
    participantCode: "PILOT-A1",
    cohort: "beginner" as const,
    experienceBand: "none",
    assignmentGroup: "A" as const,
    responses: [
      {
        taskId: "workflow-change",
        phase: "initial" as const,
        representation: "intentlang" as const,
        correctnessScore: 5,
        maximumScore: 4,
        durationSeconds: 30,
        confidence: 3,
        introducedDefects: 0,
        securityRiskOpportunities: 0,
        securityRisksIdentified: 1,
        excludedFromTiming: false
      }
    ]
  };
  assert.throws(() => analyzeStudyResults([result]), /invalid response/);
  assert.throws(
    () =>
      analyzeStudyResults([
        { ...result, responses: [] },
        { ...result, responses: [] }
      ]),
    /Duplicate participant/
  );
});
