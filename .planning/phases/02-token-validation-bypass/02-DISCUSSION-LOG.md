# Phase 2: Token Validation Bypass - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 02-token-validation-bypass
**Mode:** auto (--auto --chain)
**Areas discussed:** Token Reading Bypass, Auth Source Bypass, Approval Dialog Skip

---

## Token Reading Bypass

| Option | Description | Selected |
|--------|-------------|----------|
| Early return in getAnthropicApiKeyWithSource() when isVsCodeProxy() true | Returns ANTHROPIC_API_KEY directly, bypasses approved-list gate for VS Code sessions | ✓ |
| Prefix-based check (`vscode-lm-` prefix) | Tighter check but breaks if token format changes; redundant given isVsCodeProxy() already validates all signals | |

**User's choice:** [auto] Early return in getAnthropicApiKeyWithSource() (recommended default)
**Notes:** isVsCodeProxy() trust signal is sufficient; prefix check adds brittleness without security benefit

---

## Auth Source Bypass

| Option | Description | Selected |
|--------|-------------|----------|
| Early return in getAuthTokenSource() when isVsCodeProxy() + ANTHROPIC_API_KEY set | Returns source='ANTHROPIC_API_KEY' immediately, prevents OAuth cascade | ✓ |
| Skip at startup login gate (main.tsx) | More surgical but requires main.tsx changes; auth.ts is cleaner location | |

**User's choice:** [auto] Early return in getAuthTokenSource() (recommended default)
**Notes:** auth.ts is the right location — all auth source logic lives there; main.tsx already changed enough in Phase 1

---

## Approval Dialog Skip

| Option | Description | Selected |
|--------|-------------|----------|
| Guard with isVsCodeProxy() in Onboarding.tsx before key approval step | Skips dialog for proxy sessions; VS Code tokens are ephemeral, approval makes no sense | ✓ |
| Don't touch Onboarding.tsx — rely on approved-list bypass in getAnthropicApiKeyWithSource() | Simpler but dialog still appears (returns undefined for key after dialog suppressed) | |

**User's choice:** [auto] Guard with isVsCodeProxy() in Onboarding.tsx (recommended default)
**Notes:** Session-ephemeral tokens never need persistent approval; user would see confusing dialog on every VS Code restart otherwise

---

## Claude's Discretion

- Exact placement within each function
- JSDoc comment formatting
- Test coverage for bypass paths in auth.test.ts

## Deferred Ideas

- VS Code proxy telemetry tagging (GrowthBook)
- Cursor/other editor detection (out of scope v1)
