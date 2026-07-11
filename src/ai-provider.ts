// AI provider types, interfaces, and URL validation for IntentLang optional AI assistance.
// The compiler, Studio guided mode, and runtime never call these modules.

export const RESPONSE_BYTE_CAP = 32_768; // 32 KB max response from any provider
export const DEFAULT_TIMEOUT_MS = 60_000;
export const MIN_TIMEOUT_MS = 5_000;
export const MAX_TIMEOUT_MS = 120_000;
export const OLLAMA_DEFAULT_ENDPOINT = "http://127.0.0.1:11434";
export const OPENAI_COMPAT_DEFAULT_ENDPOINT = "http://127.0.0.1:1234";
export const GEMINI_DEFAULT_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
export const AI_API_KEY_ENV = "INTENTLANG_AI_API_KEY";

export type AiProviderKind = "none" | "ollama" | "openai-compatible" | "gemini";

export interface AiDiagnostic {
  line: number;
  column: number;
  code: string;
  message: string;
}

export interface ClarificationAnswer {
  questionId: string;
  selectedOption: string;
}

export interface AiProposalRequest {
  description: string;
  currentSource: string;
  currentDiagnostics: AiDiagnostic[];
  currentModelSummary: string;
  clarificationAnswers?: ClarificationAnswer[];
}

export interface AiRawResponse {
  body: string;
  elapsedMs: number;
}

export interface AiProvider {
  id: string;
  propose(request: AiProposalRequest, signal: AbortSignal): Promise<AiRawResponse>;
}

export interface AiConfig {
  provider: AiProviderKind;
  model: string;
  endpoint: string;
  timeoutMs: number;
  allowRemote: boolean;
}

export interface AiQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface AiProposalEnvelope {
  kind: "proposal";
  source: string;
  summary: string;
  assumptions: string[];
}

export interface AiQuestionsEnvelope {
  kind: "questions";
  questions: AiQuestion[];
}

export type AiResponseEnvelope = AiProposalEnvelope | AiQuestionsEnvelope;

export interface AiProposalResult {
  kind: "proposal";
  source: string;
  summary: string;
  assumptions: string[];
  diff: Array<{ op: "add" | "remove" | "same"; line: string }>;
  model: unknown;
  canonical: string;
}

export interface AiQuestionsResult {
  kind: "questions";
  questions: AiQuestion[];
}

export interface AiErrorResult {
  kind: "error";
  code: string;
  error: string;
  diagnostics?: AiDiagnostic[];
}

export type AiResult = AiProposalResult | AiQuestionsResult | AiErrorResult;

// ── URL validation ─────────────────────────────────────────────────────────────
// Default: loopback only (127.0.0.1, localhost, ::1).
// Remote endpoints require explicit --allow-remote-ai and HTTPS.

export type UrlValidationResult =
  | { ok: true; url: URL }
  | { ok: false; error: string };

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return h === "127.0.0.1" || h === "localhost" || h === "::1";
}

export function validateProviderUrl(
  rawUrl: string,
  allowRemote: boolean
): UrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: `Invalid provider URL: ${rawUrl}` };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      error:
        "Provider URL must not contain credentials. " +
        "Use the " + AI_API_KEY_ENV + " environment variable for API keys."
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Provider URL must use http or https protocol." };
  }

  const loopback = isLoopbackHost(parsed.hostname);

  if (!loopback) {
    if (!allowRemote) {
      return {
        ok: false,
        error:
          "Remote AI provider endpoints require the --allow-remote-ai flag. " +
          "By default only loopback addresses (127.0.0.1, localhost, ::1) are permitted."
      };
    }
    if (parsed.protocol !== "https:") {
      return {
        ok: false,
        error:
          "Remote AI provider endpoints require HTTPS. " +
          "HTTP is not permitted for non-loopback endpoints."
      };
    }
  }

  return { ok: true, url: parsed };
}

export function effectiveAiConfig(partial: Partial<AiConfig>): AiConfig {
  const provider = (partial.provider ?? "none") as AiProviderKind;
  const model = partial.model ?? "";
  const allowRemote = partial.allowRemote ?? false;

  let endpoint = partial.endpoint ?? "";
  if (!endpoint) {
    if (provider === "ollama") endpoint = OLLAMA_DEFAULT_ENDPOINT;
    else if (provider === "openai-compatible") endpoint = OPENAI_COMPAT_DEFAULT_ENDPOINT;
    else if (provider === "gemini") endpoint = GEMINI_DEFAULT_ENDPOINT;
  }

  let timeoutMs = partial.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (timeoutMs < MIN_TIMEOUT_MS) timeoutMs = MIN_TIMEOUT_MS;
  if (timeoutMs > MAX_TIMEOUT_MS) timeoutMs = MAX_TIMEOUT_MS;

  return { provider, model, endpoint, timeoutMs, allowRemote };
}
