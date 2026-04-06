---
plan: 02-02
status: complete
files_modified:
  - src/components/Onboarding.tsx
build: passing
---

# Plan 02-02 Summary — Onboarding Approval Dialog Guard

## What was done
Added `isVsCodeProxy()` guard to the `apiKeyNeedingApproval` useMemo in `src/components/Onboarding.tsx`.

Guard placement: after `!isAnthropicAuthEnabled()` check, before `normalizeApiKeyForConfig()` call.

When `isVsCodeProxy()` is true, the memo returns `''` immediately — the approval step is never rendered.

## Why
`vscode-lm-*` tokens are ephemeral (issued fresh each VS Code session). Without the guard, every session restart would show "Approve this API key?" because the new token is never in `customApiKeyResponses.approved`.

## Build
`bun run build` exits 0 — TypeScript compiles clean.

## Requirements covered
- AUTO-03: No credential validation triggered in VS Code proxy mode

## Self-Check: PASSED
- `src/components/Onboarding.tsx` modified: confirmed
- Commit `8e74aad` exists: confirmed
