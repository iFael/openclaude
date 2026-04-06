---
phase: 03-provider-profile-fallback
plan: 01
subsystem: cli
tags: [provider, vscode, copilot, env-vars, tdd]

requires:
  - phase: 02-token-validation-bypass
    provides: isVsCodeProxy() bypass guards in auth.ts that fire when CLAUDE_CODE_ENTRYPOINT=sdk-ts and CLAUDECODE=1

provides:
  - "'vscode' added to VALID_PROVIDERS in providerFlag.ts with applyProviderFlag switch case"
  - "case 'vscode' sets CLAUDE_CODE_ENTRYPOINT=sdk-ts and CLAUDECODE=1 via nullish assignment"
  - "'VS Code' preset option in ProviderManager.tsx renderPresetSelection() with guidance message"

affects: [04-documentation, future-provider-phases]

tech-stack:
  added: []
  patterns:
    - "Flag-only provider: vscode is in VALID_PROVIDERS but NOT in ProviderProfile (flag-only, no persistence)"
    - "Nullish assignment (??=) for env vars: preserves values already injected by VS Code terminal"
    - "Guard-before-preset: vscode intercepted before startCreateFromPreset() to show guidance instead of form"

key-files:
  created: []
  modified:
    - src/utils/providerFlag.ts
    - src/utils/providerFlag.test.ts
    - src/components/ProviderManager.tsx

key-decisions:
  - "D-01: vscode added to VALID_PROVIDERS (flag system) but NOT to ProviderProfile type (no persistence)"
  - "D-02: applyProviderFlag sets CLAUDE_CODE_ENTRYPOINT and CLAUDECODE via ??= — activates Phase 2 bypass guards"
  - "D-03: ANTHROPIC_BASE_URL deliberately NOT set — user must provide via env var"
  - "D-04: ANTHROPIC_API_KEY deliberately NOT set — passes through from environment"
  - "D-05 confirmed: 'vscode' does NOT appear in ProviderProfile union type in providerProfile.ts"
  - "D-07: ProviderManager shows guidance message instead of opening wizard form for vscode"

patterns-established:
  - "Flag-only providers: add to VALID_PROVIDERS + switch case, guard in ProviderManager, skip ProviderProfile"

requirements-completed: [PROF-01, PROF-02, PROF-03]

duration: 15min
completed: 2026-04-06
---

# Phase 3 Plan 1: Provider Profile Fallback Summary

**'vscode' added to --provider flag system with TDD coverage: sets CLAUDE_CODE_ENTRYPOINT=sdk-ts and CLAUDECODE=1 via nullish assignment, activating Phase 2 bypass guards; VS Code preset in /provider menu shows guidance instead of opening wizard form**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-06T00:00:00Z
- **Completed:** 2026-04-06T00:15:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `'vscode'` to `VALID_PROVIDERS` and implemented `case 'vscode':` in `applyProviderFlag()` switch
- `applyProviderFlag('vscode')` sets `CLAUDE_CODE_ENTRYPOINT ??= 'sdk-ts'` and `CLAUDECODE ??= '1'`, which activates the Phase 2 bypass guards in auth.ts automatically
- ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY are intentionally NOT set — user provides these via environment
- Added 5 TDD tests with RED-GREEN flow: RESET_KEYS extended, describe block for vscode with all nullish assignment semantics verified
- Added 'VS Code' preset to ProviderManager.tsx with description "VS Code Claude Code proxy — routes api calls through GitHub Copilot Pro+"
- Selecting 'VS Code' in /provider menu returns a guidance message instead of opening the create form

## Task Commits

Each task was committed atomically:

1. **Task 1: Add vscode to VALID_PROVIDERS, applyProviderFlag switch, and tests** - `d9cd212` (feat, TDD)
2. **Task 2: Add vscode to ProviderManager preset list with description** - `c6f8627` (feat)

## Files Created/Modified
- `src/utils/providerFlag.ts` — Added 'vscode' to VALID_PROVIDERS and case 'vscode' to applyProviderFlag switch
- `src/utils/providerFlag.test.ts` — Extended RESET_KEYS, added 5 TDD tests for vscode flag application
- `src/components/ProviderManager.tsx` — Added 'VS Code' option in renderPresetSelection() and vscode guard in onChange handler

## Decisions Made
- D-05 confirmed: `'vscode'` does NOT appear in the `ProviderProfile` union type in `src/utils/providerProfile.ts`. The VS Code token is session-ephemeral and must never be persisted in `.openclaude-profile.json`. The `vscode` entry lives only in `VALID_PROVIDERS` (flag system) — it is a flag-only provider.
- Used `??=` (nullish assignment) so values already injected by VS Code terminal are preserved if `--provider vscode` is passed in a VS Code terminal session
- Guard placed before `startCreateFromPreset()` in onChange because `vscode` is not a `ProviderPreset` type — the wizard form would type-error

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required for the code changes themselves.

Users who want to use `--provider vscode` outside VS Code terminal must set:
- `ANTHROPIC_BASE_URL=http://localhost:<PORT>` (VS Code proxy port)
- `ANTHROPIC_API_KEY=<vscode-lm-* token>` (VS Code session token)

## Next Phase Readiness
- Phase 3 complete: `openclaude --provider vscode` works without "Unknown provider" error
- All Phase 2 bypass guards (isVsCodeProxy, token format bypass, onboarding skip) activate automatically via the env var signals
- Phase 5 (documentation) can now document the `--provider vscode` flag and env var setup instructions

## Self-Check: PASSED
- `src/utils/providerFlag.ts` — FOUND: contains 'vscode' in VALID_PROVIDERS and case 'vscode' in switch
- `src/utils/providerFlag.test.ts` — FOUND: contains CLAUDE_CODE_ENTRYPOINT in RESET_KEYS and applyProviderFlag - vscode describe block
- `src/components/ProviderManager.tsx` — FOUND: contains 'VS Code Claude Code proxy' description and value === 'vscode' guard
- Commit d9cd212 — FOUND in worktree git log
- Commit c6f8627 — FOUND in worktree git log
- Build: `bun run build` exits 0
- Tests: `bun test src/utils/providerFlag.test.ts` → 25 pass, 0 fail
- D-05 guard: `grep "vscode" src/utils/providerProfile.ts` → no match

---
*Phase: 03-provider-profile-fallback*
*Completed: 2026-04-06*
