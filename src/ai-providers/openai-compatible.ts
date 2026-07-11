// OpenAI-compatible provider adapter for IntentLang optional AI assistance.
// Compatible with LM Studio, LocalAI, llama.cpp, and OpenAI-compatible cloud gateways.
// Uses POST /v1/chat/completions (OpenAI chat completion shape).
// No SDK dependency — Node.js fetch only.
// API key is read server-side only from the INTENTLANG_AI_API_KEY environment variable.
// The key is never logged, returned to the browser, or included in error messages.

import type { AiProvider, AiProposalRequest, AiRawResponse } from "../ai-provider.js";
import { RESPONSE_BYTE_CAP, AI_API_KEY_ENV } from "../ai-provider.js";

export function createOpenAiCompatibleProvider(endpoint: string, model: string): AiProvider {
  return {
    id: "openai-compatible",
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
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: 0.2,
        max_tokens: 2048
      });

      // API key from environment only — never from config, browser, or logs
      const apiKey = process.env[AI_API_KEY_ENV];
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const chatUrl = endpoint.replace(/\/$/, "") + "/v1/chat/completions";
      const start = Date.now();

      const response = await fetch(chatUrl, {
        method: "POST",
        headers,
        body: requestBody,
        signal,
        redirect: "error"
      });

      if (!response.ok) {
        // Never include response body in error: it might echo request headers
        throw new Error(`OpenAI-compatible provider returned HTTP ${response.status}`);
      }

      const body = await readCapped(response, RESPONSE_BYTE_CAP);
      const elapsedMs = Date.now() - start;

      // Extract content from OpenAI response: { choices: [{ message: { content: "..." } }] }
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new Error("OpenAI-compatible provider returned non-JSON response");
      }

      const choices =
        parsed !== null &&
        typeof parsed === "object" &&
        "choices" in parsed &&
        Array.isArray((parsed as { choices: unknown }).choices)
          ? (parsed as { choices: unknown[] }).choices
          : null;

      if (!choices || choices.length === 0) {
        throw new Error("OpenAI-compatible response missing choices array");
      }

      const first = choices[0];
      const content =
        first !== null &&
        typeof first === "object" &&
        "message" in first &&
        first.message !== null &&
        typeof first.message === "object" &&
        "content" in first.message &&
        typeof (first.message as { content: unknown }).content === "string"
          ? (first.message as { content: string }).content
          : null;

      if (content === null) {
        throw new Error("OpenAI-compatible response missing choices[0].message.content");
      }

      return { body: content, elapsedMs };
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
