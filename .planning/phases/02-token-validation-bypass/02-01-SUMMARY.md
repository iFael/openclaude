---
plan: 02-01
phase: 02
subsystem: auth
status: complete
tests_passed: 11
tests_added: 4
files_modified:
  - src/utils/auth.ts
  - src/utils/auth.test.ts
tags: [auth, vscode-proxy, bypass, tdd]
dependency_graph:
  requires: [01-proxy-detection]
  provides: [vscode-proxy-auth-bypass]
  affects: [auth-flow, api-key-validation]
tech_stack:
  added: []
  patterns: [early-return guard, env-var bypass, TDD red-green]
key_files:
  modified:
    - src/utils/auth.ts
    - src/utils/auth.test.ts
decisions:
  - isVsCodeProxy() used as sole trust signal — no additional token prefix check (D-05)
  - D-02 guard placed after ANTHROPIC_AUTH_TOKEN check, before OAuth token checks
  - D-01 guard placed after preferThirdPartyAuthentication() check, before CI/test branch
metrics:
  duration: ~15min
  completed: 2026-04-06
---

# Plan 02-01 Summary — Auth Bypass Guards

**One-liner:** Added two early-return guards using `isVsCodeProxy()` so VS Code proxy sessions use the env-var token directly, bypassing OAuth paths and the approved-list gate.

## What was done

Added two early-return bypass guards to `src/utils/auth.ts`:

1. **D-02: `getAuthTokenSource()`** — inserted after the `ANTHROPIC_AUTH_TOKEN` check (line ~191). When `isVsCodeProxy()` is true and `ANTHROPIC_API_KEY` is set, returns `{source: 'ANTHROPIC_API_KEY', hasToken: true}` immediately, before any OAuth token checks.

2. **D-01: `getAnthropicApiKeyWithSource()`** — inserted after the `preferThirdPartyAuthentication()` check (line ~294). When `isVsCodeProxy()` is true and `apiKeyEnv` is set, returns `{key: apiKeyEnv, source: 'ANTHROPIC_API_KEY'}` immediately, bypassing the `customApiKeyResponses.approved` list gate. The VS Code-issued token is session-ephemeral and can never be in the approved list by design.

## Tests

4 new tests added in `src/utils/auth.test.ts` (imports updated, `ANTHROPIC_API_KEY` added to `RESET_KEYS`):

- `getAuthTokenSource > returns ANTHROPIC_API_KEY source when proxy is active and key is set` — positive bypass path
- `getAuthTokenSource > falls through to none when proxy is active but ANTHROPIC_API_KEY is absent` — absent key edge case
- `getAuthTokenSource > does not bypass when proxy env vars are absent (no regression)` — regression guard
- `getAnthropicApiKeyWithSource > returns env key directly when proxy is active and ANTHROPIC_API_KEY is set` — positive bypass path

All 11 tests pass (7 original `isVsCodeProxy` + 4 new bypass guard tests).

## TDD Flow

- **RED:** 1 test failed (`getAuthTokenSource` positive bypass) — bypass guard not yet implemented
- **GREEN:** All 11 tests pass after both guards inserted

## Deviations from Plan

None — plan executed exactly as written.

## Requirements covered

- AUTO-02: `vscode-lm-*` tokens accepted without rejection (D-01 bypass skips approved-list check)
- AUTO-03: OAuth paths not triggered in proxy mode (D-02 bypass returns before any OAuth token checks)

## Self-Check

Files exist:
- `src/utils/auth.ts` — modified with 2 bypass guards
- `src/utils/auth.test.ts` — modified with 4 new tests

Commit exists: `0cce44d`

## Self-Check: PASSED
