# Security Policy

## Scope and current status

IntentLang is currently experimental (v0.5.x line). Security controls exist, but there are no guarantees of production readiness.

Supported branch/version for security fixes in this repo:

- `v0.5.x` (current)

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

## Disclosure expectations

- We will triage reports best-effort.
- Fix timelines are not guaranteed.
- Public disclosure should wait until maintainers acknowledge and coordinate.

## No warranty

This project is provided without security guarantees. Users must perform independent review and risk assessment before real-world use.
