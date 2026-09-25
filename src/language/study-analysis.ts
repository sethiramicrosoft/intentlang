export interface StudyResponse {
  taskId: string;
  phase: "initial" | "retention";
  representation: "intentlang" | "typescript";
  correctnessScore: number;
  maximumScore: number;
  durationSeconds: number;
  confidence: number;
  introducedDefects: number;
  securityRiskOpportunities: number;
  securityRisksIdentified: number;
  excludedFromTiming: boolean;
}

export interface StudyResult {
  studyVersion: string;
  participantCode: string;
  cohort:
    | "domain-expert"
    | "developer"
    | "security-reviewer"
    | "beginner";
  experienceBand: string;
  assignmentGroup: "A" | "B";
  responses: StudyResponse[];
}

export interface StudyAggregate {
  cohort: StudyResult["cohort"];
  representation: StudyResponse["representation"];
  responses: number;
  meanCorrectness: number;
  correctnessDistribution: Record<string, number>;
  medianDurationSeconds: number | null;
  durationInterquartileRange: {
    firstQuartile: number;
    thirdQuartile: number;
  } | null;
  meanConfidence: number;
  calibrationGap: number;
  defectRate: number;
  securityRiskDetectionRate: number | null;
  meanRetentionCorrectness: number | null;
  timingExclusions: number;
}

function mean(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function quantile(values: number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}

export function analyzeStudyResults(results: StudyResult[]): StudyAggregate[] {
  const participants = new Set<string>();
  for (const result of results) {
    if (participants.has(result.participantCode)) {
      throw new Error(`Duplicate participant code ${result.participantCode}.`);
    }
    participants.add(result.participantCode);
    for (const response of result.responses) {
      if (
        response.maximumScore <= 0 ||
        response.correctnessScore < 0 ||
        response.correctnessScore > response.maximumScore ||
        response.durationSeconds < 0 ||
        response.confidence < 1 ||
        response.confidence > 5 ||
        response.introducedDefects < 0 ||
        response.securityRiskOpportunities < 0 ||
        response.securityRisksIdentified < 0 ||
        response.securityRisksIdentified > response.securityRiskOpportunities
      ) {
        throw new Error(
          `Participant ${result.participantCode} has an invalid response.`
        );
      }
    }
  }
  const groups = new Map<string, {
    cohort: StudyResult["cohort"];
    representation: StudyResponse["representation"];
    responses: StudyResponse[];
  }>();
  for (const result of results) {
    for (const response of result.responses) {
      const key = `${result.cohort}:${response.representation}`;
      const group = groups.get(key) ?? {
        cohort: result.cohort,
        representation: response.representation,
        responses: []
      };
      group.responses.push(response);
      groups.set(key, group);
    }
  }
  return Array.from(groups.values(), (group) => {
    const initialResponses = group.responses.filter(
      (response) => response.phase === "initial"
    );
    const retentionResponses = group.responses.filter(
      (response) => response.phase === "retention"
    );
    const correctness = initialResponses.map(
      (response) => response.correctnessScore / response.maximumScore
    );
    const confidence = initialResponses.map(
      (response) => (response.confidence - 1) / 4
    );
    const durations = initialResponses
      .filter((response) => !response.excludedFromTiming)
      .map((response) => response.durationSeconds);
    const riskOpportunities = initialResponses.reduce(
      (total, response) => total + response.securityRiskOpportunities,
      0
    );
    const firstQuartile = quantile(durations, 0.25);
    const thirdQuartile = quantile(durations, 0.75);
    const correctnessDistribution = correctness.reduce<Record<string, number>>(
      (distribution, score) => {
        const key = score.toFixed(2);
        distribution[key] = (distribution[key] ?? 0) + 1;
        return distribution;
      },
      {}
    );
    return {
      cohort: group.cohort,
      representation: group.representation,
      responses: group.responses.length,
      meanCorrectness: mean(correctness),
      correctnessDistribution,
      medianDurationSeconds: median(durations),
      durationInterquartileRange:
        firstQuartile === null || thirdQuartile === null
          ? null
          : { firstQuartile, thirdQuartile },
      meanConfidence: mean(confidence),
      calibrationGap: mean(confidence) - mean(correctness),
      defectRate: initialResponses.length === 0
        ? 0
        : initialResponses.filter((response) => response.introducedDefects > 0)
          .length / initialResponses.length,
      securityRiskDetectionRate: riskOpportunities === 0
        ? null
        : initialResponses.reduce(
          (total, response) => total + response.securityRisksIdentified,
          0
        ) / riskOpportunities,
      meanRetentionCorrectness: retentionResponses.length === 0
        ? null
        : mean(
          retentionResponses.map(
            (response) => response.correctnessScore / response.maximumScore
          )
        ),
      timingExclusions: initialResponses.filter(
        (response) => response.excludedFromTiming
      ).length
    };
  }).sort((left, right) =>
    `${left.cohort}:${left.representation}`.localeCompare(
      `${right.cohort}:${right.representation}`,
      "en"
    )
  );
}
