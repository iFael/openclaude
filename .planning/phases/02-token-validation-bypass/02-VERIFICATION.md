---
phase: 02-token-validation-bypass
verified: 2026-04-06T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
human_verification:
  - test: "Launch openclaude inside VS Code integrated terminal with a vscode-lm-* token injected as ANTHROPIC_API_KEY"
    expected: "Application starts without printing 'invalid API key', token format rejection error, or any auth error to stderr/stdout"
    why_human: "End-to-end runtime behavior in a live VS Code session with a real GitHub Copilot Pro+ token cannot be confirmed by static code analysis alone"
  - test: "Launch openclaude outside VS Code (ANTHROPIC_BASE_URL not set or not localhost) with a standard sk-ant-* API key"
    expected: "Approval dialog appears as before for a new key not in the approved list — existing flow is fully intact"
    why_human: "The Onboarding approval dialog is a terminal UI component; its conditional rendering under isVsCodeProxy()=false requires a visual run to confirm no regression"
---

# Phase 2: Token Validation Bypass — Verification Report

**Phase Goal:** `openclaude` accepts `vscode-lm-*` tokens without error and does not trigger any OAuth or Anthropic credential validation when running behind the VS Code proxy.

**Verified:** 2026-04-06
**Status:** HUMAN_NEEDED — all code-level checks pass; 2 runtime behaviors require human confirmation
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `vscode-lm-*` token passed as ANTHROPIC_API_KEY passes auth validation without rejection | VERIFIED | Test `getAnthropicApiKeyWithSource > returns env key directly when proxy is active` passes — key `vscode-lm-anthropic.claude-opus-4-5-abc.def` returned as-is; `isValidApiKey` regex only called from `saveApiKey()` (user-initiated write path), never in startup auth flow |
| 2 | `getAuthTokenSource()` returns `{source: 'ANTHROPIC_API_KEY', hasToken: true}` without triggering OAuth when proxy is active | VERIFIED | D-02 guard at `auth.ts:195` returns before CLAUDE_CODE_OAUTH_TOKEN check at line 199; confirmed by test `getAuthTokenSource > returns ANTHROPIC_API_KEY source when proxy is active and key is set` |
| 3 | `getAnthropicApiKeyWithSource()` returns env key directly, bypassing approved-list gate, when proxy is active | VERIFIED | D-01 guard at `auth.ts:298` returns before CI/approved-list block at line 302; confirmed by test `getAnthropicApiKeyWithSource > returns env key directly when proxy is active` |
| 4 | Onboarding approval dialog is suppressed when proxy is active | VERIFIED | D-03 guard at `Onboarding.tsx:106` returns `''` from `apiKeyNeedingApproval` useMemo before `normalizeApiKeyForConfig` is called; `apiKeyNeedingApproval` is falsy so the `api-key` step is never pushed to `steps[]` |
| 5 | All existing auth paths are unaffected — no regressions | VERIFIED | 7 original `isVsCodeProxy` tests pass; regression test `does not bypass when proxy env vars are absent` passes; D-04 constraint honored (isBareMode, isValidApiKey, saveApiKey paths untouched) |

**Score:** 4/4 programmatically verifiable truths verified (5th truth — regression — also verified)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/auth.ts` (D-02) | `if (isVsCodeProxy() && process.env.ANTHROPIC_API_KEY)` inside `getAuthTokenSource()` | VERIFIED | Line 195; positioned after ANTHROPIC_AUTH_TOKEN block (line 191), before CLAUDE_CODE_OAUTH_TOKEN check (line 199) |
| `src/utils/auth.ts` (D-01) | `if (isVsCodeProxy() && apiKeyEnv)` inside `getAnthropicApiKeyWithSource()` | VERIFIED | Line 298; positioned after `preferThirdPartyAuthentication()` block (line 294), before CI branch (line 302) |
| `src/utils/auth.test.ts` | 4 new test cases in 2 describe blocks covering D-01 and D-02 | VERIFIED | `describe('getAuthTokenSource - VS Code proxy bypass (D-02)')` at line 75 with 3 tests; `describe('getAnthropicApiKeyWithSource - VS Code proxy bypass (D-01)')` at line 105 with 1 test |
| `src/components/Onboarding.tsx` (D-03) | `if (isVsCodeProxy())` guard inside `apiKeyNeedingApproval` useMemo | VERIFIED | Line 106; `isVsCodeProxy` imported at line 8; guard positioned after `isAnthropicAuthEnabled()` check (line 102), before `normalizeApiKeyForConfig` call (line 109) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `auth.ts:getAuthTokenSource` | ANTHROPIC_API_KEY env var | `isVsCodeProxy() && process.env.ANTHROPIC_API_KEY` at line 195 | WIRED | Pattern confirmed at correct position; early-return skips all OAuth paths |
| `auth.ts:getAnthropicApiKeyWithSource` | `apiKeyEnv` direct return | `isVsCodeProxy() && apiKeyEnv` at line 298 | WIRED | Pattern confirmed at correct position; early-return skips approved-list gate |
| `Onboarding.tsx:apiKeyNeedingApproval` | Approval dialog bypass | `isVsCodeProxy()` early return of `''` at line 106 | WIRED | Import present at line 8; guard confirmed at correct position in useMemo |
| `auth.test.ts` | `getAuthTokenSource`, `getAnthropicApiKeyWithSource` | Named imports at line 2 | WIRED | Both functions imported; all 4 new tests exercise the bypass paths |

---

### Data-Flow Trace (Level 4)

Not applicable — these are utility functions and a component useMemo, not data-rendering components. The key concern (token reaching API call) is handled by the proxy receiving the env-var token directly; the bypass ensures it is not rejected before being forwarded.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 11 tests pass (7 original + 4 new) | `bun test src/utils/auth.test.ts` | `11 pass, 0 fail` | PASS |
| D-02 guard exists at correct location | `grep -n "isVsCodeProxy() && process.env.ANTHROPIC_API_KEY" src/utils/auth.ts` | Line 195 | PASS |
| D-01 guard exists at correct location | `grep -n "isVsCodeProxy() && apiKeyEnv" src/utils/auth.ts` | Line 298 | PASS |
| D-03 guard exists in Onboarding useMemo | `grep -n "if (isVsCodeProxy())" src/components/Onboarding.tsx` | Line 106 | PASS |
| isVsCodeProxy imported in Onboarding | `grep "isAnthropicAuthEnabled, isVsCodeProxy" src/components/Onboarding.tsx` | Line 8 | PASS |
| Commits documented in summaries exist in git log | `git log --oneline` | `0cce44d` and `8e74aad` present | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTO-02 | 02-01 | OpenClaude accepts `vscode-lm-*` tokens as valid ANTHROPIC_API_KEY (no format rejection) | SATISFIED | D-01 and D-02 guards bypass all local validation; `isValidApiKey` only called from `saveApiKey` (write path, not startup) |
| AUTO-03 | 02-01, 02-02 | In VS Code proxy mode, no OAuth validation or token renewal is attempted | SATISFIED | D-02 returns before OAuth checks; D-01 returns before approved-list gate; D-03 suppresses approval dialog |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None | — | All inserted code is intentional early-return guards with explanatory comments; no TODO/FIXME/placeholder patterns introduced |

---

### Human Verification Required

#### 1. End-to-end startup in VS Code integrated terminal

**Test:** Open VS Code with GitHub Copilot Pro+ active, open the integrated terminal (which sets `CLAUDE_CODE_ENTRYPOINT=sdk-ts`, `CLAUDECODE=1`, and `ANTHROPIC_BASE_URL=http://localhost:<port>`), and run `openclaude`.

**Expected:** Application starts normally. No "invalid API key", "token format rejection", or auth error appears. The session proceeds to the prompt without an onboarding approval dialog for the API key.

**Why human:** This requires a live VS Code session with a real `vscode-lm-*` token injected by GitHub Copilot. Static analysis confirms the bypass code paths are in place, but the actual token format and any other startup-path checks beyond auth.ts can only be confirmed through execution.

#### 2. Regression — standard key approval dialog is unaffected

**Test:** Run `openclaude` outside VS Code (no `CLAUDECODE=1` or no `CLAUDE_CODE_ENTRYPOINT=sdk-ts`) with a new `sk-ant-*` key set as `ANTHROPIC_API_KEY` that is not yet in `customApiKeyResponses.approved`.

**Expected:** The "Approve this API key?" onboarding dialog appears as it did before Phase 2 changes.

**Why human:** The Onboarding component renders in the terminal as an interactive UI; confirming the conditional step rendering (`if (apiKeyNeedingApproval)` at `Onboarding.tsx:131`) behaves correctly for non-proxy sessions requires a visual run.

---

### Gaps Summary

No gaps. All code-level success criteria are met:

- **SC1** (no format rejection error): The two bypass guards in `auth.ts` and the approval dialog guard in `Onboarding.tsx` collectively eliminate every local code path that could reject a `vscode-lm-*` token. The `isValidApiKey` regex (which would reject dots) is only invoked from `saveApiKey()`, which is never called in the automated startup flow.
- **SC2** (`vscode-lm-*` passes auth validation): Directly confirmed by unit test with the exact token format `vscode-lm-anthropic.claude-opus-4-5-abc.def`.
- **SC3** (no OAuth or credential check): D-02 returns before any OAuth token check; D-01 returns before the approved-list gate; D-03 prevents the approval dialog from rendering.
- **SC4** (no regressions): All 7 pre-existing `isVsCodeProxy` tests pass; a dedicated regression test confirms non-proxy sessions are unaffected; D-04 constraint (isBareMode/isValidApiKey/saveApiKey untouched) is honored.

The two human verification items are confirmations of observable runtime behavior, not open code questions.

---

_Verified: 2026-04-06_
_Verifier: Claude (gsd-verifier)_
