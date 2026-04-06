---
quick_id: 260406-nf5
status: complete
completed: "2026-04-06"
---

# Quick Fix: Skip OAuth Onboarding Step in VS Code Proxy Mode

## Problem

When running `openclaude` in a VS Code terminal with GitHub Copilot Pro+ active,
the "Select login method" screen appeared even though valid auth env vars were set:
- `ANTHROPIC_BASE_URL=http://localhost:<port>` ← VS Code proxy
- `ANTHROPIC_API_KEY=vscode-lm-*` ← VS Code session token
- `CLAUDE_CODE_ENTRYPOINT=sdk-ts` + `CLAUDECODE=1`

## Root Cause

`src/components/Onboarding.tsx` pushed the `oauth` step (ConsoleOAuthFlow →
"Select login method") unconditionally whenever `oauthEnabled` was true.

The `SkippableStep` wrapper only skips when `skipOAuth === true`, but that flag
is only set from `handleApiKeyDone(approved=true)` — which is never called when
the `api-key` step is bypassed (Phase 2 guard returns `''` for VS Code proxy).

Result: onboarding flow always reached the "Select login method" screen when
`hasCompletedOnboarding: false`, regardless of proxy detection.

## Fix

**File:** `src/components/Onboarding.tsx` — line 137

```typescript
// Before:
if (oauthEnabled) {

// After:
if (oauthEnabled && !isVsCodeProxy()) {
```

When `isVsCodeProxy()` returns true, the oauth step is never added to the
steps array. Onboarding proceeds `preflight → theme → security → done`.
Auth is handled automatically via Phase 2 bypass guards in auth.ts.

## Verification

- `grep -n "isVsCodeProxy" src/components/Onboarding.tsx` → 3 matches (import, api-key bypass, oauth guard)
- `bun run build` → `✓ Built openclaude v0.1.9` (exit 0)
- `bun test src/utils/auth.test.ts src/utils/providerFlag.test.ts` → 36 pass, 0 fail
- `npm install -g .` → global binary updated
- `openclaude --version` → `0.1.9 (Open Claude)`

## Commit

`990779a` — `fix(onboarding): skip oauth step when running in VS Code proxy mode`
