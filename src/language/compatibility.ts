import type { SemanticManifest } from "./contracts.js";

export type CompatibilityClassification =
  | "identical"
  | "source-only"
  | "dependency-change"
  | "generator-change"
  | "semantic-change";

export interface CompatibilityResult {
  classification: CompatibilityClassification;
  semanticChange: boolean;
  requiresReview: boolean;
  reasons: string[];
}

export function classifyCompatibility(
  previous: SemanticManifest,
  current: SemanticManifest
): CompatibilityResult {
  const reasons: string[] = [];
  if (previous.semanticFingerprint !== current.semanticFingerprint) {
    reasons.push("semantic fingerprint changed");
    return {
      classification: "semantic-change",
      semanticChange: true,
      requiresReview: true,
      reasons
    };
  }
  if (previous.dependencyFingerprint !== current.dependencyFingerprint) {
    reasons.push("dependency fingerprint changed");
    return {
      classification: "dependency-change",
      semanticChange: false,
      requiresReview: true,
      reasons
    };
  }
  if (
    JSON.stringify(previous.generatorVersions) !==
    JSON.stringify(current.generatorVersions)
  ) {
    reasons.push("generator versions changed");
    return {
      classification: "generator-change",
      semanticChange: false,
      requiresReview: true,
      reasons
    };
  }
  if (previous.sourceFingerprint !== current.sourceFingerprint) {
    reasons.push("canonical source fingerprint changed");
    return {
      classification: "source-only",
      semanticChange: false,
      requiresReview: false,
      reasons
    };
  }
  return {
    classification: "identical",
    semanticChange: false,
    requiresReview: false,
    reasons
  };
}
