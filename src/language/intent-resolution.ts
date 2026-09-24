import { formatSource } from "../formatter.js";
import {
  interpretDescription,
  type ClarificationQuestion as LegacyQuestion
} from "../description-interpreter.js";
import { compileSource } from "../compiler.js";
import { sha256 } from "./semantic-fingerprint.js";

export const clarificationCategories = [
  "security",
  "ownership",
  "workflow",
  "type",
  "default",
  "failure-mode"
] as const;

export type ClarificationCategory =
  (typeof clarificationCategories)[number];

export interface IntentQuestion extends LegacyQuestion {
  category: ClarificationCategory;
  rationale: string;
}

export interface IntentConceptModel {
  description: string;
  requestsUsers: boolean;
  requestsOwnership: boolean;
  workflowVerbs: string[];
  unsupportedEffects: string[];
}

export interface IntentProposal {
  kind: "proposal";
  canonicalSource: string;
  assumptions: string[];
  warnings: string[];
  explanations: {
    data: string[];
    security: string[];
    workflow: string[];
    sideEffects: string[];
  };
  confirmationFingerprint: string;
}

export type IntentResolutionResult =
  | IntentProposal
  | {
      kind: "clarification";
      concepts: IntentConceptModel;
      questions: IntentQuestion[];
    }
  | { kind: "unrecognized"; reason: string };

export type IntentAnswers = Record<string, string>;

export function extractIntentConcepts(
  description: string
): IntentConceptModel {
  const workflowVerbs = Array.from(
    new Set(
      description
        .toLowerCase()
        .match(/\b(?:approve|reject|complete|start|pause|publish|reopen)\b/g) ??
        []
    )
  );
  const unsupportedEffects = Array.from(
    new Set(
      description
        .toLowerCase()
        .match(
          /\b(?:email|notification|upload|attachment|sorting|sort|search|filter|delete|remove)\b/g
        ) ?? []
    )
  );
  return {
    description: description.trim(),
    requestsUsers: /\busers?\b|\bmembers?\b|\blogin\b|\bsign in\b/i.test(
      description
    ),
    requestsOwnership: /\btheir own\b|\bowned by\b|\bowner\b/i.test(
      description
    ),
    workflowVerbs,
    unsupportedEffects
  };
}

function clarificationQuestions(
  concepts: IntentConceptModel,
  answers: IntentAnswers
): IntentQuestion[] {
  const questions: IntentQuestion[] = [];
  if (concepts.requestsUsers && !answers["security.identity"]) {
    questions.push({
      id: "security.identity",
      category: "security",
      question: "Does “user” mean a stored record or an authenticated account?",
      options: ["person-record", "authenticated-account"],
      rationale:
        "Authentication changes generated identity, authorization, and account-provisioning behavior."
    });
  }
  if (concepts.requestsOwnership && !answers["ownership.scope"]) {
    questions.push({
      id: "ownership.scope",
      category: "ownership",
      question: "Who may read and update an owned record?",
      options: ["owner-only", "all-authenticated", "administrator-and-owner"],
      rationale:
        "Ownership scope must be explicit because generated backends are default-deny."
    });
  }
  if (concepts.workflowVerbs.length > 0 && !answers["workflow.invalid"]) {
    questions.push({
      id: "workflow.invalid",
      category: "workflow",
      question: "What should happen when a workflow transition is invalid?",
      options: ["reject-with-error", "ignore", "administrator-override"],
      rationale:
        "Failure behavior is part of the transition semantics and cannot be inferred."
    });
  }
  if (
    /\bdefault\b|\binitially\b|\bstarts? as\b/i.test(concepts.description) &&
    !answers["default.values"]
  ) {
    questions.push({
      id: "default.values",
      category: "default",
      question: "Are the described initial values required defaults?",
      options: ["use-described-defaults", "require-explicit-input"],
      rationale:
        "Defaults change stored data even when the user supplies no value."
    });
  }
  if (
    concepts.unsupportedEffects.length > 0 &&
    !answers["failure-mode.unsupported"]
  ) {
    questions.push({
      id: "failure-mode.unsupported",
      category: "failure-mode",
      question: "How should unsupported requested side effects be handled?",
      options: ["exclude-and-report", "reject-proposal"],
      rationale:
        "Unsupported side effects must never be silently approximated."
    });
  }
  return questions;
}

export function resolveIntent(
  description: string,
  answers: IntentAnswers = {}
): IntentResolutionResult {
  const concepts = extractIntentConcepts(description);
  const questions = clarificationQuestions(concepts, answers);
  const preview = interpretDescription(description, { usersAnswer: "person" });
  if (preview.kind === "proposal") {
    for (const unsupported of preview.unsupportedCapabilities) {
      if (unsupported.code !== "UNRECOGNIZED_FIELD") continue;
      const field = unsupported.capability
        .trim()
        .toLowerCase()
        .replace(/\s+([a-z])/g, (_, letter: string) => letter.toUpperCase());
      const id = `type.${field}`;
      if (!answers[id]) {
        questions.push({
          id,
          category: "type",
          question: `What type should field “${unsupported.capability}” use?`,
          options: ["text", "integer", "boolean"],
          rationale:
            "Unknown field names require an explicit representation; the resolver never guesses a type."
        });
      }
    }
  }
  if (questions.length > 0) {
    return { kind: "clarification", concepts, questions };
  }
  if (
    answers["failure-mode.unsupported"] === "reject-proposal" &&
    concepts.unsupportedEffects.length > 0
  ) {
    return {
      kind: "unrecognized",
      reason: `Proposal rejected because these effects are unsupported: ${concepts.unsupportedEffects.join(", ")}.`
    };
  }

  const interpreted = interpretDescription(description, {
    usersAnswer:
      answers["security.identity"] === "authenticated-account"
        ? "auth-user"
        : "person"
  });
  if (interpreted.kind !== "proposal") {
    return {
      kind: "unrecognized",
      reason:
        interpreted.kind === "unrecognized"
          ? interpreted.reason
          : "Additional clarification is required."
    };
  }
  const answeredFields =
    preview.kind === "proposal"
      ? preview.unsupportedCapabilities
          .filter((item) => item.code === "UNRECOGNIZED_FIELD")
          .flatMap((item) => {
            const field = item.capability
              .trim()
              .toLowerCase()
              .replace(/\s+([a-z])/g, (_, letter: string) =>
                letter.toUpperCase()
              );
            const type = answers[`type.${field}`];
            if (!["text", "integer", "boolean"].includes(type ?? "")) return [];
            const entityArticle = /^[aeiou]/i.test(interpreted.entityName)
              ? "an"
              : "a";
            const fieldArticle = /^[aeiou]/i.test(field) ? "an" : "a";
            return [
              `${entityArticle} ${interpreted.entityName} has ${fieldArticle} ${field} as ${type}`
            ];
          })
      : [];
  const proposedSource =
    answeredFields.length > 0
      ? `${interpreted.source.trimEnd()}\n${answeredFields.join("\n")}\n`
      : interpreted.source;
  const compiled = compileSource(proposedSource);
  if (!compiled.ok) {
    return {
      kind: "unrecognized",
      reason: `The deterministic proposal did not compile: ${compiled.diagnostics
        .map((item) => item.code)
        .join(", ")}.`
    };
  }
  const canonicalSource = formatSource(compiled.ir);
  const sideEffects = interpreted.unsupportedCapabilities
    .filter(
      (item) =>
        item.code !== "UNRECOGNIZED_FIELD" ||
        !answers[
          `type.${item.capability
            .trim()
            .toLowerCase()
            .replace(/\s+([a-z])/g, (_, letter: string) =>
              letter.toUpperCase()
            )}`
        ]
    )
    .map(
    (item) => `${item.capability}: excluded (${item.code})`
  );
  return {
    kind: "proposal",
    canonicalSource,
    assumptions: interpreted.assumptions,
    warnings: interpreted.warnings,
    explanations: {
      data: [
        `${compiled.ir.entities.length} entity`,
        `${compiled.ir.entities.reduce((sum, entity) => sum + entity.fields.length, 0)} fields`
      ],
      security: [
        compiled.ir.authentication
          ? "Authentication enabled"
          : "No authentication or authorization generated"
      ],
      workflow: [
        `${compiled.ir.actions.length} guarded workflow transitions`
      ],
      sideEffects:
        sideEffects.length > 0
          ? sideEffects
          : ["No external side effects generated"]
    },
    confirmationFingerprint: sha256(
      JSON.stringify({
        description: concepts.description,
        answers,
        canonicalSource
      })
    )
  };
}
