# Security Policy

## Scope and current status

IntentLang is currently experimental (v0.7.x line). Security controls exist, but there are no guarantees of production readiness.

Supported branch/version for security fixes in this repo:

- `v0.7.x` (current)

## Reporting a vulnerability safely

Please do **not** disclose exploit details publicly first.

Because no private contact channel is published in this repository:

1. Prefer opening a **GitHub Security Advisory draft** for this repository (if enabled).
2. If Security Advisories are unavailable, open a minimal GitHub issue requesting a private contact channel.
   - Do not include exploit steps, payloads, secrets, tokens, credentials, or private data.
   - Include only high-level impact and affected area.

## What to include in a report

- Affected version/commit
- High-level impact
- Minimal reproduction outline without secrets
- Suggested remediation direction (optional)

## Credential and secret handling policy

- Never commit passwords, tokens, API keys, or secret-bearing test values.
- Tests should generate ephemeral auth inputs at runtime.
- Issues/PRs must not contain private user data or credential material.
- The `INTENTLANG_AI_API_KEY` environment variable is never logged, serialized, returned to the browser, or included in error messages.

## AI assistance threat model (v0.7+)

AI assistance is optional and off by default. The following threat areas apply when AI is enabled:

### Prompt injection
User-supplied source content is delimited with `<<CURRENT_SOURCE_START>>` / `<<CURRENT_SOURCE_END>>` markers and the system prompt instructs the model to treat delimited content as data, not instructions. However, prompt injection is an inherent risk in all LLM systems. Mitigations:
- Proposals always go through deterministic compiler validation before any user action is possible.
- Invalid proposals are rejected with diagnostics and cannot be applied.
- AI output is untrusted text: it cannot write files, execute commands, access databases, read arbitrary files, or override compiler errors.

### SSRF (Server-Side Request Forgery) via provider endpoint
The provider endpoint is configured at server startup via CLI flags only — the browser cannot override it. Mitigations:
- Only loopback endpoints (`127.0.0.1`, `localhost`, `::1`) are permitted by default.
- Remote endpoints require explicit `--allow-remote-ai` and must use HTTPS.
- Credentials in URLs are rejected at startup.
- `redirect: 'error'` is used on all provider fetch calls.
- The browser receives only the provider id, model name, and endpoint origin — never the API key.

### API key exposure
The `INTENTLANG_AI_API_KEY` environment variable is the only way to supply an API key. Mitigations:
- Key is attached to provider requests server-side only (`Authorization: Bearer`).
- Key is never logged, written to disk, returned to the browser, or included in error messages.
- Provider error responses that might echo headers are not forwarded to the browser.

### Model output injection in UI
AI-generated text is rendered via `textContent` only — no `innerHTML` on any AI output. The diff pane uses DOM element creation. No HTML is rendered from model responses.

## Disclosure expectations

- We will triage reports best-effort.
- Fix timelines are not guaranteed.
- Public disclosure should wait until maintainers acknowledge and coordinate.

## No warranty

This project is provided without security guarantees. Users must perform independent review and risk assessment before real-world use.
