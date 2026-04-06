---
phase: 01-proxy-detection-feedback
plan: "02"
subsystem: startup
tags: [startup-message, stderr, interactive-guard, proxy-feedback]
dependency_graph:
  requires: [isVsCodeProxy]
  provides: [vscode-proxy-startup-message]
  affects: [src/main.tsx]
tech_stack:
  added: []
  patterns: [process.stderr.write, plain-diagnostic, guard-condition]
key_files:
  created: []
  modified:
    - src/main.tsx
decisions:
  - "Injection point is after initializeEntrypoint() (~line 816) so isInteractive is in scope (D-08)"
  - "Plain process.stderr.write without chalk per D-07 (informational, not error/warning)"
  - "isVsCodeProxy added to existing auth.js destructure import in alphabetical order"
metrics:
  duration: ~5 minutes
  completed: "2026-04-06"
  tasks_completed: 1
  files_changed: 1
requirements:
  - AUTO-04
---

# Phase 01 Plan 02: VS Code Proxy Startup Message Summary

## One-liner

Wires `isVsCodeProxy()` into `src/main.tsx` startup path to print a plain stderr confirmation message when GitHub Copilot Pro+ proxy is active and session is interactive.

## What Was Built

Updated `src/main.tsx` with two changes:

1. **Import addition (line 52):** Added `isVsCodeProxy` to the existing `./utils/auth.js` destructure import, inserted alphabetically between `isClaudeAISubscriber` and `prefetchAwsCredentialsAndBedRockInfoIfSafe`.

2. **Startup message block (lines 818-821):** Injected immediately after `initializeEntrypoint(isNonInteractive)` and before `// Determine client type`:
   ```typescript
   // Print VS Code proxy confirmation before session init — interactive only (D-05, D-06, D-07, D-08)
   if (isVsCodeProxy() && isInteractive && !isBareMode()) {
     process.stderr.write('Using VS Code Claude Code proxy (GitHub Copilot Pro+)\n')
   }
   ```

Guard conditions:
- `isVsCodeProxy()` — only fires when ANTHROPIC_BASE_URL is localhost + CLAUDE_CODE_ENTRYPOINT === 'sdk-ts' + CLAUDECODE === '1'
- `isInteractive` — suppresses in `--print`/`-p` and `--init-only` headless modes and non-TTY environments
- `!isBareMode()` — suppresses in minimal `--bare` mode

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 873bcc3 | feat | wire isVsCodeProxy() startup message into src/main.tsx |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Injection after `initializeEntrypoint()` at line 816 | `isInteractive` variable is only defined at line 812 (D-08 requires it as a guard) — injection before that point is not possible |
| `process.stderr.write` without chalk | D-07: plain message, not an error/warning — no color needed |
| Single import update, no new import statement | `isVsCodeProxy` lives in `./utils/auth.js` which is already imported; extend existing destructure per project conventions |
| `isBareMode` not re-imported | Already imported at line 110 from `./utils/envUtils.js` |

## Deviations from Plan

None — plan executed exactly as written. The injection point reconciliation note in the plan (D-05 estimated ~line 520, but D-08 requires `isInteractive` which is at line 812) was pre-resolved in the plan's action spec. The correct injection site at line 816 was used as specified.

## Known Stubs

None — the message is fully wired. When all three guard conditions are met, the message prints immediately. No stub data, no placeholder text.

## Threat Flags

No new threat surface beyond the plan's threat model (T-01-03 and T-01-04 both accepted: informational stderr output, no credentials disclosed).

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/main.tsx isVsCodeProxy import (line 52) | FOUND — 2 occurrences total |
| src/main.tsx message block (lines 818-821) | FOUND |
| Message text "Using VS Code Claude Code proxy" | FOUND — exactly 1 occurrence |
| isClaudeAISubscriber still present | FOUND — import not regressed |
| commit 873bcc3 | FOUND |
