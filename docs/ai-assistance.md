# Optional AI Assistance

IntentLang v0.7.0-alpha adds **optional** AI assistance to Studio. The core compiler, guided mode, and all generated applications remain completely AI-free and consume zero tokens.

## Offline interpreter vs AI assistant

Studio v0.7.1 introduces a second path in **Describe App** mode that does not require AI:

| | Offline interpreter | AI assistant |
|---|---|---|
| Requires AI provider | No | Yes |
| Internet/tokens | No | Depends on provider |
| Supported vocabulary | Finite (see [description-mode.md](description-mode.md)) | Broader |
| Deterministic output | Yes — same input → same output | No |
| Unsupported features | Listed explicitly | May be listed or silently omitted |
| Auth/security rules | Never silently added | Depends on model |

**Recommended default:** use the offline interpreter for simple CRUD apps (entity + fields). Fall back to AI only for descriptions the offline interpreter does not recognise.

## What AI assistance does (and does not do)

| Feature | AI-free | With AI |
|---|---|---|
| Compile source | ✅ | ✅ |
| Instant error diagnostics | ✅ | ✅ |
| Format, check, save | ✅ | ✅ |
| Generate full-stack app | ✅ | ✅ |
| Describe App — offline interpreter | ✅ | ✅ |
| Describe App — broader descriptions | ❌ | ✅ (optional) |

AI output is **untrusted text**. It cannot:
- Write files or execute commands
- Access databases or read arbitrary files
- Override compiler errors
- Trigger app generation automatically

Flow: user description + current source → provider → proposed IntentLang → **deterministic compiler validation** → interpreted diff → explicit user Apply → separate Save → separate Generate App.

## Supported providers

Any model exposed through **Ollama**, an **OpenAI-compatible chat API**, or **Google Gemini** is supported.

### Provider 1: Ollama (local, recommended)

[Ollama](https://ollama.com/) runs models locally with no per-token API fees (subject to license, hardware, and electricity costs).

```bash
# Install Ollama, then pull a model:
ollama pull llama3.2

# Start Studio with Ollama:
intentlang studio my-app.intent \
  --ai-provider ollama \
  --ai-model llama3.2
```

Default endpoint: `http://127.0.0.1:11434` (loopback, data stays on your machine).

### Provider 2: OpenAI-compatible (LM Studio, LocalAI, cloud gateways)

LM Studio, LocalAI, llama.cpp servers, and many cloud gateways expose an OpenAI-compatible `/v1/chat/completions` endpoint.

**Local (LM Studio example):**
```bash
# Start LM Studio server, then:
intentlang studio my-app.intent \
  --ai-provider openai-compatible \
  --ai-model <model-name> \
  --ai-endpoint http://127.0.0.1:1234
```

**Cloud gateway (requires HTTPS and explicit remote flag):**
```bash
# Set API key before starting Studio (never pass as flag):
export INTENTLANG_AI_API_KEY=<your-key>

intentlang studio my-app.intent \
  --ai-provider openai-compatible \
  --ai-model <model-name> \
  --ai-endpoint https://your-gateway.example.com \
  --allow-remote-ai
```

> **Note:** Many open/local models can be run without per-token API fees, subject to their license terms and your hardware and electricity costs. Cloud gateways may charge per token — check your provider's pricing.

### Provider 3: Google Gemini (direct REST API)

IntentLang connects directly to the Google Gemini `generateContent` REST API (no SDK dependency). This is a **remote** provider — it always requires `--allow-remote-ai`.

```bash
# Set API key before starting Studio (never pass as flag):
export INTENTLANG_AI_API_KEY=<your-key>

intentlang studio my-app.intent \
  --ai-provider gemini \
  --ai-model <your-gemini-model> \
  --allow-remote-ai
```

Default endpoint: `https://generativelanguage.googleapis.com/v1beta` (canonical Google Gemini API base).

> **Privacy notice:** When the Gemini provider is selected, your description and the current source are sent to Google Gemini's endpoint. Free-tier availability, quotas, billing, and terms of service are **controlled by your Google account** and can change. Check [Google AI Studio](https://aistudio.google.com/) for current quota and billing details.

> **API key:** Set `INTENTLANG_AI_API_KEY` in your environment before starting Studio. The key is attached to requests using the `x-goog-api-key` header (not URL query parameters). It is never logged, never returned to the browser, and never included in error messages.

## CLI flags

| Flag | Default | Description |
|---|---|---|
| `--ai-provider` | `none` | `none`, `ollama`, `openai-compatible`, or `gemini` |
| `--ai-model` | (provider default) | Model name to request |
| `--ai-endpoint` | loopback default | Base URL for the provider API |
| `--ai-timeout` | `60000` | Request timeout in milliseconds (5000–120000) |
| `--allow-remote-ai` | false | Required for non-loopback endpoints (must use HTTPS). Required for `gemini`. |

**API key:** set the `INTENTLANG_AI_API_KEY` environment variable before starting Studio. It is never passed as a CLI flag (avoids shell history), never logged, never returned to the browser, and never included in error messages. For `openai-compatible`, it is sent as `Authorization: Bearer`. For `gemini`, it is sent as `x-goog-api-key` header (not URL query parameter).

## Privacy and security boundary

- **Local providers** (loopback endpoint): your description and current source are sent to the local server process. Data does not leave your machine, subject to the local server's own behavior.
- **Remote providers** (`--allow-remote-ai` + HTTPS): your description and current source are sent to the configured remote endpoint. Costs, privacy, and data retention depend on that provider's policies.
- **Google Gemini** (`--ai-provider gemini`): description and current source are sent to Google Gemini. Free-tier availability, quotas, billing, and terms are controlled by your Google account and can change. See [Google AI Studio](https://aistudio.google.com/) for current limits.
- **Compiler and generated apps are always AI-free.** Compilation, error diagnostics, formatting, and app generation never contact any AI provider.
- **Configuration is process memory only.** No AI config, prompts, or responses are written to disk or logs automatically.
- **API key is server-side only.** The browser JS never sees the API key. The key is attached to provider requests server-side only via `Authorization: Bearer`.

## How proposals work

1. Enter a description in the **AI Assist** panel (opened from the editor toolbar).
2. The AI may ask clarification questions — select answers and send.
3. A valid proposal is compiled deterministically. Invalid proposals are rejected with diagnostics and cannot be applied.
4. Click **Review & Apply Proposal** to see the line diff. Click **Apply to Editor** to update the editor memory only (file on disk unchanged).
5. **Save** separately to write to disk.
6. **Generate App** is a separate step — AI has no effect on generation.

## Architecture overview

```
CLI flags → effectiveAiConfig() → AiAssistant
                                      ├── AiProvider interface
                                      │     ├── OllamaProvider (POST /api/chat)
                                      │     ├── OpenAiCompatibleProvider (POST /v1/chat/completions)
                                      │     └── GeminiProvider (POST /models/{model}:generateContent)
                                      ├── buildSystemPrompt() — grammar + examples
                                      ├── buildUserMessage() — grounded context with delimiters
                                      ├── parseAndValidate() — strict JSON parsing
                                      └── compileSource() — deterministic compiler validation
```

The browser only sends: description, currentSource, clarificationAnswers. It never sends provider endpoint, API key, or any override of server-side config.

## Security considerations

- **Prompt injection:** user source content is strictly delimited with `<<CURRENT_SOURCE_START>>` / `<<CURRENT_SOURCE_END>>`. The system prompt instructs the model to treat delimited content as data. As with all LLM systems, prompt injection is a known risk; proposals always go through deterministic compiler validation before any action is possible.
- **SSRF:** by default only loopback endpoints are permitted. Remote endpoints require `--allow-remote-ai` and HTTPS. Credentials in URLs are rejected. Redirects use `redirect: 'error'`.
- **Response safety:** responses are size-capped at 32 KB. All model text is rendered via `textContent` (no `innerHTML` on AI output). Proposals that fail compilation are rejected with diagnostics.
- **API key handling:** read from `INTENTLANG_AI_API_KEY` environment variable only. Never logged, serialized, returned to browser, or included in error messages. For `openai-compatible`, sent as `Authorization: Bearer`. For `gemini`, sent as `x-goog-api-key` header.

## Troubleshooting

**"AI assistance is off"** — Start Studio with `--ai-provider ollama`, `--ai-provider openai-compatible`, or `--ai-provider gemini`.

**"Provider error: HTTP 404"** — Check your `--ai-endpoint` URL and that the server is running. For Ollama, default is `http://127.0.0.1:11434`.

**"Provider response missing message.content"** — The model response shape didn't match expected format. Try a different model.

**"AI proposed source has compiler errors"** — The model generated invalid IntentLang. The proposal is rejected. Try rephrasing your description or use a larger/more capable model.

**"Remote AI provider endpoints require --allow-remote-ai"** — Add `--allow-remote-ai` flag and ensure your endpoint uses HTTPS.

## Writing a provider adapter

Implement the `AiProvider` interface in `src/ai-providers/`:

```typescript
import type { AiProvider, AiProposalRequest, AiRawResponse } from "../ai-provider.js";

export function createMyProvider(endpoint: string, model: string): AiProvider {
  return {
    id: "my-provider",
    async propose(request: AiProposalRequest, signal: AbortSignal): Promise<AiRawResponse> {
      const { buildSystemPrompt, buildUserMessage } = await import("../ai-prompt.js");
      const systemPrompt = buildSystemPrompt();
      const userMessage = buildUserMessage({ /* ... */ });
      // ... call your endpoint, return { body: string, elapsedMs: number }
      // body must be the model's text content (the JSON envelope string)
    }
  };
}
```

Register in `src/ai-assistant.ts` `createAiAssistant()`. Add tests in `test/ai.test.ts` using a mock HTTP server (no real AI calls, no credentials).

Key requirements for new adapters:
- Use `Node.js fetch` only — no SDK dependencies
- Use `redirect: 'error'`
- Never log or return the API key
- Cap response body reading at `RESPONSE_BYTE_CAP`
- Throw on non-2xx status (without including response body in error message, as it may echo headers)
