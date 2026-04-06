---
phase: 01-proxy-detection-feedback
plan: "01"
subsystem: auth
tags: [detection, env-vars, tdd, pure-function]
dependency_graph:
  requires: []
  provides: [isVsCodeProxy]
  affects: [src/utils/auth.ts]
tech_stack:
  added: []
  patterns: [bun-test, beforeEach-env-reset, pure-function-detection]
key_files:
  created:
    - src/utils/auth.test.ts
  modified:
    - src/utils/auth.ts
decisions:
  - "Used new URL(baseUrl).hostname for port-agnostic localhost detection (D-02)"
  - "Exact string match CLAUDECODE === '1' per D-01, not isEnvTruthy"
  - "try/catch wraps URL parsing to handle malformed values without throwing"
  - "Function is not exported from isManagedOAuthContext — intentionally private"
metrics:
  duration: ~8 minutes
  completed: "2026-04-06"
  tasks_completed: 1
  files_changed: 2
requirements:
  - AUTO-01
---

# Phase 01 Plan 01: isVsCodeProxy Detection Summary

## One-liner

Pure synchronous `isVsCodeProxy()` using `new URL().hostname` for port-agnostic localhost detection with exact env-var matching.

## What Was Built

Added `isVsCodeProxy()` exported function to `src/utils/auth.ts`, inserted immediately after `isManagedOAuthContext()` (line 98). The function detects the VS Code Claude Code proxy environment by checking all three conditions simultaneously:

1. `ANTHROPIC_BASE_URL` is set and its hostname is `'localhost'` (any port — port-agnostic per D-02)
2. `CLAUDE_CODE_ENTRYPOINT === 'sdk-ts'`
3. `CLAUDECODE === '1'`

A `try/catch` wraps the `new URL()` call to silently return `false` for malformed URLs.

Also created `src/utils/auth.test.ts` with 7 unit tests covering all branches:
- All conditions met → `true`
- Missing `ANTHROPIC_BASE_URL` → `false`
- Non-localhost URL → `false`
- Missing `CLAUDECODE` → `false`
- Wrong `CLAUDE_CODE_ENTRYPOINT` value → `false`
- Different localhost port (8080) → `true` (port-agnostic)
- Malformed URL (`not-a-url`) → `false` without throwing

## TDD Flow

**RED:** Created `src/utils/auth.test.ts` with 7 tests importing the not-yet-existing `isVsCodeProxy`. Tests failed with `SyntaxError: Export named 'isVsCodeProxy' not found`. Committed: `5f79a15`

**GREEN:** Implemented `isVsCodeProxy()` in `src/utils/auth.ts`. All 7 tests passed (0 failures). Committed: `62b5b87`

**REFACTOR:** No refactoring needed — implementation was clean from the start.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 5f79a15 | test | add failing tests for isVsCodeProxy() (RED) |
| 62b5b87 | feat | implement isVsCodeProxy() in src/utils/auth.ts (GREEN) |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| `new URL(baseUrl).hostname === 'localhost'` | Port-agnostic check — any localhost port returns true per D-02 |
| `process.env.CLAUDECODE === '1'` exact match | D-01 specifies exact match, not truthy check |
| `try/catch` around URL parsing | Handles malformed URLs safely per Test 7 requirement |
| No `isEnvTruthy` for CLAUDECODE | D-01 explicitly requires exact string equality |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing node_modules / bun not in PATH**
- **Found during:** RED phase test run
- **Issue:** Bun was not in the shell PATH (Git Bash / MINGW64). `node_modules` did not exist in the worktree.
- **Fix:** Used `npx bun install` to install dependencies (453 packages), and used `npx bun test` for all test runs.
- **Files modified:** `node_modules/` (not committed — in .gitignore)
- **Commit:** N/A (runtime fix, no code change)

## Known Stubs

None — the function is fully implemented and tested.

## Threat Flags

No new threat surface introduced beyond what the plan's threat model already covers (T-01-01, T-01-02 both accepted).

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/utils/auth.ts | FOUND |
| src/utils/auth.test.ts | FOUND |
| 01-01-SUMMARY.md | FOUND |
| commit 5f79a15 (test RED) | FOUND |
| commit 62b5b87 (feat GREEN) | FOUND |
