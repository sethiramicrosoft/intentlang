// AI assistant orchestration for IntentLang optional AI assistance.
// Coordinates provider calls, response parsing, compiler validation, and diff computation.
// Model output is untrusted text. AI cannot write files, execute commands, access databases,
// read arbitrary files, or override compiler errors.

import { compileSource } from "./compiler.js";
import { formatSource } from "./compiler.js";
import { buildStudioViewModel } from "./studio-viewmodel.js";
import {
  RESPONSE_BYTE_CAP,
  MIN_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
  validateProviderUrl,
  effectiveAiConfig
} from "./ai-provider.js";
import type {
  AiConfig,
  AiProvider,
  AiProviderKind,
  AiResult,
  AiProposalResult,
  AiQuestionsResult,
  AiErrorResult,
  AiResponseEnvelope,
  AiQuestion,
  ClarificationAnswer,
  AiDiagnostic
} from "./ai-provider.js";

export type { AiConfig, AiResult, AiProposalResult, AiQuestionsResult, AiErrorResult };

// Rate limiting: one active request per instance prevents concurrent token spend
// Sequential requests (e.g. questions → answers → proposal) are intentionally allowed.

export interface AiAssistantInfo {
  provider: AiProviderKind;
  model: string;
  endpointOrigin: string;
  isLocal: boolean;
}

export interface AiProposeParams {
  description: string;
  currentSource: string;
  currentDiagnostics: AiDiagnostic[];
  currentModelSummary: string;
  clarificationAnswers?: ClarificationAnswer[];
}

export interface AiAssistant {
  readonly info: AiAssistantInfo;
  readonly isActive: boolean;
  propose(params: AiProposeParams): Promise<AiResult>;
  cancel(): void;
}

// ── Create assistant ───────────────────────────────────────────────────────────

export async function createAiAssistant(partialConfig: Partial<AiConfig>): Promise<{
  assistant: AiAssistant;
  configError?: string;
}> {
  const config = effectiveAiConfig(partialConfig);

  if (config.provider === "none") {
    return { assistant: createNoneAssistant() };
  }

  // Validate endpoint URL
  const urlResult = validateProviderUrl(config.endpoint, config.allowRemote);
  if (!urlResult.ok) {
    return {
      assistant: createNoneAssistant(),
      configError: urlResult.error
    };
  }

  const endpointOrigin = urlResult.url.origin;
  const isLocal =
    urlResult.url.hostname === "127.0.0.1" ||
    urlResult.url.hostname === "localhost" ||
    urlResult.url.hostname === "::1" ||
    urlResult.url.hostname === "[::1]";

  let provider: AiProvider;
  if (config.provider === "ollama") {
    const { createOllamaProvider } = await import("./ai-providers/ollama.js");
    provider = createOllamaProvider(config.endpoint, config.model);
  } else {
    const { createOpenAiCompatibleProvider } = await import("./ai-providers/openai-compatible.js");
    provider = createOpenAiCompatibleProvider(config.endpoint, config.model);
  }

  const info: AiAssistantInfo = {
    provider: config.provider,
    model: config.model,
    endpointOrigin,
    isLocal
  };

  let active = false;
  let currentAbort: AbortController | null = null;

  const assistant: AiAssistant = {
    get info() { return info; },
    get isActive() { return active; },

    cancel() {
      currentAbort?.abort();
    },

    async propose(params: AiProposeParams): Promise<AiResult> {
      if (active) {
        return errorResult("AI_RATE_LIMITED", "A request is already in progress. Cancel it before starting a new one.");
      }

      active = true;
      currentAbort = new AbortController();
      const timeoutMs = Math.min(Math.max(config.timeoutMs, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
      const timeoutId = setTimeout(() => currentAbort?.abort(), timeoutMs);

      try {
        const rawResponse = await provider.propose(
          {
            description: params.description,
            currentSource: params.currentSource,
            currentDiagnostics: params.currentDiagnostics,
            currentModelSummary: params.currentModelSummary,
            clarificationAnswers: params.clarificationAnswers
          },
          currentAbort.signal
        );

        if (rawResponse.body.length > RESPONSE_BYTE_CAP) {
          return errorResult("AI_RESPONSE_INVALID", "Provider response exceeded size limit.");
        }

        return parseAndValidate(rawResponse.body, params.currentSource);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          err instanceof Error &&
          (err.name === "AbortError" || err.message.includes("aborted"))
        ) {
          if (timeoutId) clearTimeout(timeoutId);
          return errorResult("AI_TIMEOUT", "Request was cancelled or timed out.");
        }
        return errorResult("AI_PROVIDER_UNAVAILABLE", `Provider error: ${sanitizeError(msg)}`);
      } finally {
        clearTimeout(timeoutId);
        active = false;
        currentAbort = null;
      }
    }
  };

  return { assistant };
}

// ── None provider ─────────────────────────────────────────────────────────────

function createNoneAssistant(): AiAssistant {
  const info: AiAssistantInfo = {
    provider: "none",
    model: "",
    endpointOrigin: "",
    isLocal: true
  };

  return {
    get info() { return info; },
    get isActive() { return false; },
    cancel() {},
    async propose(): Promise<AiResult> {
      return errorResult(
        "AI_DISABLED",
        "AI assistance is not configured. Start Studio with --ai-provider to enable it. " +
          "The compiler and guided mode work without AI."
      );
    }
  };
}

// ── Response parsing and validation ──────────────────────────────────────────

function parseAndValidate(body: string, currentSource: string): AiResult {
  let envelope: unknown;
  try {
    envelope = JSON.parse(body.trim());
  } catch {
    return errorResult(
      "AI_RESPONSE_INVALID",
      "Provider returned non-JSON output. Check that your model returns valid JSON."
    );
  }

  if (envelope === null || typeof envelope !== "object") {
    return errorResult("AI_RESPONSE_INVALID", "Provider response must be a JSON object.");
  }

  const obj = envelope as Record<string, unknown>;
  const kind = obj["kind"];

  if (kind === "questions") {
    return parseQuestionsEnvelope(obj);
  } else if (kind === "proposal") {
    return parseProposalEnvelope(obj, currentSource);
  } else {
    return errorResult(
      "AI_RESPONSE_INVALID",
      `Provider response has unexpected kind: ${JSON.stringify(kind)}. Expected "proposal" or "questions".`
    );
  }
}

function parseQuestionsEnvelope(obj: Record<string, unknown>): AiResult {
  const raw = obj["questions"];
  if (!Array.isArray(raw) || raw.length === 0) {
    return errorResult("AI_RESPONSE_INVALID", "Questions response must have a non-empty questions array.");
  }

  const questions: AiQuestion[] = [];
  for (const q of raw) {
    if (q === null || typeof q !== "object") {
      return errorResult("AI_RESPONSE_INVALID", "Each question must be an object.");
    }
    const qObj = q as Record<string, unknown>;
    const id = qObj["id"];
    const question = qObj["question"];
    const options = qObj["options"];

    if (typeof id !== "string" || id.length === 0) {
      return errorResult("AI_RESPONSE_INVALID", "Each question must have a non-empty string id.");
    }
    if (typeof question !== "string" || question.length === 0) {
      return errorResult("AI_RESPONSE_INVALID", "Each question must have non-empty question text.");
    }
    if (!Array.isArray(options) || options.length < 2) {
      return errorResult("AI_RESPONSE_INVALID", "Each question must have at least two options.");
    }
    for (const opt of options) {
      if (typeof opt !== "string") {
        return errorResult("AI_RESPONSE_INVALID", "Question options must be strings.");
      }
    }

    questions.push({ id: String(id), question: String(question), options: options as string[] });
  }

  const result: AiQuestionsResult = { kind: "questions", questions };
  return result;
}

function parseProposalEnvelope(obj: Record<string, unknown>, currentSource: string): AiResult {
  const source = obj["source"];
  const summary = obj["summary"];
  const rawAssumptions = obj["assumptions"];

  if (typeof source !== "string" || source.trim().length === 0) {
    return errorResult("AI_PROPOSAL_INVALID", "Proposal must include a non-empty source field.");
  }
  if (typeof summary !== "string" || summary.trim().length === 0) {
    return errorResult("AI_PROPOSAL_INVALID", "Proposal must include a non-empty summary field.");
  }

  const assumptions: string[] = [];
  if (Array.isArray(rawAssumptions)) {
    for (const a of rawAssumptions) {
      if (typeof a === "string") assumptions.push(a);
    }
  }

  // Compile the proposed source — AI output is untrusted
  const compileResult = compileSource(source);
  if (!compileResult.ok) {
    const diags: AiDiagnostic[] = compileResult.diagnostics.map((d) => ({
      line: d.line,
      column: d.column,
      code: d.code,
      message: d.message
    }));
    const errorResult2: AiErrorResult = {
      kind: "error",
      code: "AI_PROPOSAL_INVALID",
      error: "AI proposed source has compiler errors. The proposal cannot be applied until errors are fixed.",
      diagnostics: diags
    };
    return errorResult2;
  }

  const canonical = formatSource(compileResult.ir);
  const model = buildStudioViewModel(compileResult.ir);
  const diff = computeDiff(currentSource, source);

  const result: AiProposalResult = {
    kind: "proposal",
    source,
    summary: summary.trim(),
    assumptions,
    diff,
    model,
    canonical
  };
  return result;
}

// ── Diff computation ───────────────────────────────────────────────────────────

function computeDiff(
  original: string,
  proposed: string
): Array<{ op: "add" | "remove" | "same"; line: string }> {
  const origLines = original.split("\n");
  const propLines = proposed.split("\n");
  const result: Array<{ op: "add" | "remove" | "same"; line: string }> = [];
  const max = Math.max(origLines.length, propLines.length);

  for (let i = 0; i < max; i++) {
    const o = origLines[i];
    const p = propLines[i];
    if (o === undefined) {
      result.push({ op: "add", line: p! });
    } else if (p === undefined) {
      result.push({ op: "remove", line: o });
    } else if (o === p) {
      result.push({ op: "same", line: o });
    } else {
      result.push({ op: "remove", line: o });
      result.push({ op: "add", line: p });
    }
  }
  return result;
}

// ── Error helpers ──────────────────────────────────────────────────────────────

function errorResult(code: string, error: string): AiErrorResult {
  return { kind: "error", code, error };
}

// Strip any path or header fragments from provider error messages to avoid
// accidentally echoing environment details.
function sanitizeError(msg: string): string {
  return msg.replace(/https?:\/\/[^\s]+/g, "[redacted-url]").slice(0, 200);
}
