// Gemini provider adapter for IntentLang optional AI assistance.
// Uses the Google Gemini generateContent REST API directly.
// No SDK dependency — Node.js fetch only.
// API key is read server-side only from the INTENTLANG_AI_API_KEY environment variable.
// The key is sent via x-goog-api-key header — never via URL query params, never logged,
// never returned to the browser, and never included in error messages.

import type { AiProvider, AiProposalRequest, AiRawResponse } from "../ai-provider.js";
import { RESPONSE_BYTE_CAP, AI_API_KEY_ENV } from "../ai-provider.js";

const MAX_MODEL_NAME_BYTES = 256;

export function createGeminiProvider(endpoint: string, model: string): AiProvider {
  if (!model || model.trim().length === 0) {
    throw new Error("Gemini provider requires a non-empty model name via --ai-model.");
  }
  if (Buffer.byteLength(model, "utf8") > MAX_MODEL_NAME_BYTES) {
    throw new Error("Gemini model name exceeds maximum allowed length.");
  }

  return {
    id: "gemini",
    async propose(request: AiProposalRequest, signal: AbortSignal): Promise<AiRawResponse> {
      const { buildSystemPrompt, buildUserMessage } = await import("../ai-prompt.js");

      const systemPrompt = buildSystemPrompt();
      const userMessage = buildUserMessage({
        description: request.description,
        currentSource: request.currentSource,
        currentDiagnostics: request.currentDiagnostics,
        currentModelSummary: request.currentModelSummary,
        clarificationAnswers: request.clarificationAnswers
      });

      const requestBody = JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userMessage }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      });

      // API key from environment only — never from config, browser, or logs
      const apiKey = process.env[AI_API_KEY_ENV];
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (apiKey) {
        headers["x-goog-api-key"] = apiKey;
      }

      const encodedModel = encodeURIComponent(model.trim());
      const generateUrl = endpoint.replace(/\/$/, "") + `/models/${encodedModel}:generateContent`;
      const start = Date.now();

      const response = await fetch(generateUrl, {
        method: "POST",
        headers,
        body: requestBody,
        signal,
        redirect: "error"
      });

      if (!response.ok) {
        // Never include response body — it may echo request headers containing the API key
        throw new Error(`Gemini provider returned HTTP ${response.status}`);
      }

      const body = await readCapped(response, RESPONSE_BYTE_CAP);
      const elapsedMs = Date.now() - start;

      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new Error("Gemini provider returned non-JSON response");
      }

      if (parsed === null || typeof parsed !== "object") {
        throw new Error("Gemini response is not a JSON object");
      }

      const obj = parsed as Record<string, unknown>;

      // Check for prompt-level safety block (candidates absent or empty)
      const promptFeedback = obj["promptFeedback"];
      if (
        promptFeedback !== null &&
        typeof promptFeedback === "object" &&
        "blockReason" in (promptFeedback as object)
      ) {
        const reason = (promptFeedback as Record<string, unknown>)["blockReason"];
        throw new Error(
          `Gemini request was blocked by safety filters` +
            (typeof reason === "string" ? ` (${reason})` : "")
        );
      }

      const candidates = obj["candidates"];
      if (!Array.isArray(candidates) || candidates.length === 0) {
        throw new Error("Gemini response contains no candidates");
      }

      const first = candidates[0];
      if (first === null || typeof first !== "object") {
        throw new Error("Gemini candidates[0] is not an object");
      }

      const content = (first as Record<string, unknown>)["content"];
      if (content === null || typeof content !== "object") {
        throw new Error("Gemini candidates[0].content is missing or invalid");
      }

      const parts = (content as Record<string, unknown>)["parts"];
      if (!Array.isArray(parts) || parts.length === 0) {
        throw new Error("Gemini candidates[0].content.parts is empty or missing");
      }

      // Join all text parts deterministically
      const textSegments: string[] = [];
      for (const part of parts) {
        if (part !== null && typeof part === "object" && "text" in (part as object)) {
          const t = (part as Record<string, unknown>)["text"];
          if (typeof t === "string") {
            textSegments.push(t);
          }
        }
      }

      if (textSegments.length === 0) {
        throw new Error("Gemini response parts contain no text content");
      }

      return { body: textSegments.join(""), elapsedMs };
    }
  };
}

async function readCapped(response: Response, cap: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return await response.text();
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.length;
      if (total > cap) {
        reader.cancel().catch(() => {});
        throw new Error(`Provider response exceeded ${cap} byte limit`);
      }
      chunks.push(value);
    }
  }

  return Buffer.concat(chunks).toString("utf8");
}
