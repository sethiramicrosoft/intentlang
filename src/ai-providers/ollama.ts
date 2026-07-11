// Ollama provider adapter for IntentLang optional AI assistance.
// Uses the Ollama chat endpoint: POST /api/chat
// No SDK dependency — Node.js fetch only.

import type { AiProvider, AiProposalRequest, AiRawResponse } from "../ai-provider.js";
import { RESPONSE_BYTE_CAP } from "../ai-provider.js";

export function createOllamaProvider(endpoint: string, model: string): AiProvider {
  return {
    id: "ollama",
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
        stream: false,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ]
      });

      const start = Date.now();

      const response = await fetch(`${endpoint}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
        signal,
        redirect: "error"
      });

      if (!response.ok) {
        throw new Error(`Ollama provider returned HTTP ${response.status}`);
      }

      const body = await readCapped(response, RESPONSE_BYTE_CAP);
      const elapsedMs = Date.now() - start;

      // Extract content from Ollama response shape: { message: { content: "..." } }
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new Error("Ollama returned non-JSON response");
      }

      const content =
        parsed !== null &&
        typeof parsed === "object" &&
        "message" in parsed &&
        parsed.message !== null &&
        typeof parsed.message === "object" &&
        "content" in parsed.message &&
        typeof (parsed.message as { content: unknown }).content === "string"
          ? (parsed.message as { content: string }).content
          : null;

      if (content === null) {
        throw new Error("Ollama response missing message.content field");
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
        throw new Error(
          `Provider response exceeded ${cap} byte limit`
        );
      }
      chunks.push(value);
    }
  }

  return Buffer.concat(chunks).toString("utf8");
}
