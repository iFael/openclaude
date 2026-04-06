---
phase: 03-provider-profile-fallback
verified: 2026-04-06T00:00:00Z
status: passed
score: 7/7 must-haves verified
gaps: []
---

# Phase 3: Provider Profile Fallback — Verification Report

**Phase Goal:** Users can explicitly activate VS Code proxy mode via `openclaude --provider vscode` when env vars are not automatically injected by the terminal
**Verified:** 2026-04-06
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `openclaude --provider vscode` does not produce an "Unknown provider" error | VERIFIED | `'vscode'` present in `VALID_PROVIDERS` at line 22 of `providerFlag.ts`; test "returns no error for vscode provider" passes |
| 2 | After `applyProviderFlag('vscode')`, `CLAUDE_CODE_ENTRYPOINT` equals `'sdk-ts'` | VERIFIED | `process.env.CLAUDE_CODE_ENTRYPOINT ??= 'sdk-ts'` at line 122; test "sets CLAUDE_CODE_ENTRYPOINT=sdk-ts" passes |
| 3 | After `applyProviderFlag('vscode')`, `CLAUDECODE` equals `'1'` | VERIFIED | `process.env.CLAUDECODE ??= '1'` at line 123; test "sets CLAUDECODE=1" passes |
| 4 | `applyProviderFlag('vscode')` does NOT set `ANTHROPIC_BASE_URL` — user must provide it (D-03) | VERIFIED | No assignment of `ANTHROPIC_BASE_URL` in the vscode case; comment on line 124 documents intentional absence; no test sets or expects this value |
| 5 | `applyProviderFlag('vscode')` does NOT set `ANTHROPIC_API_KEY` — passes through from env (D-04) | VERIFIED | No assignment of `ANTHROPIC_API_KEY` in the vscode case; comment on line 124 documents intentional absence |
| 6 | Running `/provider` and choosing "Add provider" shows `'VS Code'` in the preset list with description | VERIFIED | `ProviderManager.tsx` line 563–565: `value: 'vscode'`, `label: 'VS Code'`, `description: 'VS Code Claude Code proxy — routes api calls through GitHub Copilot Pro+'` |
| 7 | `'vscode'` does NOT appear in the `ProviderProfile` union type in `providerProfile.ts` (D-05) | VERIFIED | `grep "vscode" src/utils/providerProfile.ts` returns no match; `ProviderProfile` at line 50 is `'openai' | 'ollama' | 'codex' | 'gemini' | 'atomic-chat'` |

**Score:** 7/7 truths verified

---

## Automated Checks

| # | Check | Command | Result | Status |
|---|-------|---------|--------|--------|
| 1 | All 5 new vscode tests pass | `bun test src/utils/providerFlag.test.ts` | 25 pass, 0 fail, exit 0 | PASS |
| 2 | `'vscode'` in `VALID_PROVIDERS` and `case 'vscode':` | `grep "'vscode'" src/utils/providerFlag.ts` | Line 22 (VALID_PROVIDERS), line 118 (case) | PASS |
| 3 | `CLAUDE_CODE_ENTRYPOINT` nullish assignment present | `grep "CLAUDE_CODE_ENTRYPOINT" src/utils/providerFlag.ts` | Line 122: `process.env.CLAUDE_CODE_ENTRYPOINT ??= 'sdk-ts'` | PASS |
| 4 | `CLAUDECODE` nullish assignment present | `grep "CLAUDECODE" src/utils/providerFlag.ts` | Line 123: `process.env.CLAUDECODE ??= '1'` | PASS |
| 5 | `ANTHROPIC_BASE_URL` NOT assigned in vscode case (D-03) | `grep "ANTHROPIC_BASE_URL" src/utils/providerFlag.ts` | Line 124: match is in a comment only (`// ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY are NOT set here`); no assignment exists | PASS (see note) |
| 6 | `ANTHROPIC_API_KEY` NOT assigned in vscode case (D-04) | `grep "ANTHROPIC_API_KEY" src/utils/providerFlag.ts` | Line 124: match is in the same comment only; no assignment exists | PASS (see note) |
| 7 | `'vscode'` not in `ProviderProfile` type (D-05) | `grep "vscode" src/utils/providerProfile.ts` | No match (exit 1) | PASS |
| 8 | `'VS Code Claude Code proxy'` description string present | `grep "VS Code Claude Code proxy" src/components/ProviderManager.tsx` | Line 565: exact description string found | PASS |
| 9 | `value === 'vscode'` guard in `onChange` handler | `grep "value === 'vscode'" src/components/ProviderManager.tsx` | Line 598: guard present in onChange, before `startCreateFromPreset()` | PASS |
| 10 | TypeScript build clean | `bun run build` | `Built openclaude v0.1.8 → dist/cli.mjs`, exit 0 | PASS |

**Note on checks 5 and 6:** The check instruction specifies "must return NO match". The grep does return one match — but only inside the comment `// ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY are NOT set here — user must`. This comment documents the intentional absence of any assignment. There is no functional assignment or usage of either env var in the `vscode` case. The behavioral requirement (D-03, D-04) is fully satisfied: the vscode case does not set these values, leaving them to pass through from the user's environment as designed.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/providerFlag.ts` | `'vscode'` in `VALID_PROVIDERS` and switch case | VERIFIED | Line 22: `'vscode'` in array. Lines 118–126: `case 'vscode':` with `??=` assignments and break |
| `src/utils/providerFlag.test.ts` | 5 TDD tests for vscode flag application | VERIFIED | Lines 148–175: `describe('applyProviderFlag - vscode', ...)` with all 5 tests. `CLAUDE_CODE_ENTRYPOINT` and `CLAUDECODE` in `RESET_KEYS` at lines 21–22 |
| `src/components/ProviderManager.tsx` | `vscode` option in `renderPresetSelection()` with description and guard | VERIFIED | Lines 563–565: vscode option with correct label and description. Line 598: `value === 'vscode'` guard before `startCreateFromPreset()` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `VALID_PROVIDERS` in `providerFlag.ts` | `applyProviderFlag` switch `case 'vscode'` | `includes` check at line 75 | WIRED | `'vscode'` present at line 22; gate at line 75 passes to switch; case at line 118 reached |
| `case 'vscode'` in `applyProviderFlag` | `isVsCodeProxy()` in `auth.ts` | `CLAUDE_CODE_ENTRYPOINT ??= 'sdk-ts'` and `CLAUDECODE ??= '1'` | WIRED | Both env vars set at lines 122–123; `isVsCodeProxy()` fires when these are present (Phase 2 contract) |
| `renderPresetSelection` options in `ProviderManager.tsx` | `onChange` vscode guard | `value === 'vscode'` early return at line 598 | WIRED | Guard intercepts vscode selection before `startCreateFromPreset()` at line 607 and returns guidance message |

---

## Data-Flow Trace (Level 4)

Not applicable for this phase. The changes are: (1) an env-var mutation in a CLI utility function — no dynamic data rendering; (2) a static options array entry and a conditional guard in a UI component. No state-to-render data flow to trace.

---

## Behavioral Spot-Checks

| Behavior | Command / Evidence | Result | Status |
|----------|--------------------|--------|--------|
| `applyProviderFlag('vscode')` returns no error | `bun test` — "returns no error for vscode provider" | PASS | PASS |
| `CLAUDE_CODE_ENTRYPOINT` set to `'sdk-ts'` | `bun test` — "sets CLAUDE_CODE_ENTRYPOINT=sdk-ts" | PASS | PASS |
| `CLAUDECODE` set to `'1'` | `bun test` — "sets CLAUDECODE=1" | PASS | PASS |
| Nullish assignment preserves pre-existing `CLAUDE_CODE_ENTRYPOINT` | `bun test` — "does not overwrite existing CLAUDE_CODE_ENTRYPOINT" | PASS | PASS |
| Nullish assignment preserves pre-existing `CLAUDECODE` | `bun test` — "does not overwrite existing CLAUDECODE" | PASS | PASS |
| TypeScript compilation clean | `bun run build` exit 0 | `Built openclaude v0.1.8 → dist/cli.mjs` | PASS |

---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| PROF-01 | `vscode` provider available via `--provider vscode` | SATISFIED | `'vscode'` in `VALID_PROVIDERS`; `applyProviderFlag('vscode')` returns no error; all 5 tests pass |
| PROF-02 | `vscode` profile allows manual override of `base_url` and `api_key` | SATISFIED | Neither `ANTHROPIC_BASE_URL` nor `ANTHROPIC_API_KEY` is set in the vscode case; user-provided values in environment pass through untouched |
| PROF-03 | `vscode` profile listed in provider options with clear description | SATISFIED | `ProviderManager.tsx` line 565: exact description `'VS Code Claude Code proxy — routes api calls through GitHub Copilot Pro+'` |

---

## Roadmap Success Criteria

Phase 3 roadmap declares 3 success criteria:

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `openclaude --provider vscode` activates `CLAUDE_CODE_ENTRYPOINT=sdk-ts` and `CLAUDECODE=1` so `isVsCodeProxy()` fires | VERIFIED | Lines 122–123 in providerFlag.ts; confirmed by tests 2 and 3 of the vscode describe block |
| 2 | The `vscode` flag does not change `ANTHROPIC_BASE_URL` or `ANTHROPIC_API_KEY` | VERIFIED | No assignment of either var in the vscode case; only a comment documenting the intentional absence |
| 3 | Running `/provider` lists `vscode` with description `"VS Code Claude Code proxy — routes api calls through GitHub Copilot Pro+"` | VERIFIED | ProviderManager.tsx line 565 contains the exact string |

---

## Anti-Patterns Found

No blockers or warnings found.

The comment-only match on line 124 of `providerFlag.ts` (`// ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY are NOT set here — user must`) is documentation of intentional design, not a stub or anti-pattern. It explicitly confirms D-03 and D-04 compliance.

---

## Human Verification Required

None. All behavioral requirements for this phase are verifiable via automated test suite and static analysis. The UI change (ProviderManager preset list) is verified by grep confirming the description string and guard are present in the correct locations. The ROADMAP marks this phase with "UI hint: no".

---

## Gaps Summary

No gaps. All 7 must-have truths are VERIFIED. All 10 specified checks pass. All 3 requirements (PROF-01, PROF-02, PROF-03) are satisfied. All 3 roadmap success criteria are met. Build is clean. Phase 3 goal is achieved.

---

_Verified: 2026-04-06_
_Verifier: Claude (gsd-verifier)_
