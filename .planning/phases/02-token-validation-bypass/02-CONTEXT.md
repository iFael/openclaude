# Phase 2: Token Validation Bypass - Context

**Gathered:** 2026-04-06 (auto mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Make `openclaude` accept `vscode-lm-*` tokens without rejection and prevent any Anthropic OAuth or credential validation flow from triggering when running inside the VS Code Claude Code proxy. Phase 1's `isVsCodeProxy()` is already available and gates all changes here.

</domain>

<decisions>
## Implementation Decisions

### Token Reading Bypass (`getAnthropicApiKeyWithSource`)
- **D-01:** In `getAnthropicApiKeyWithSource()` (`src/utils/auth.ts` line ~283), add an early return immediately after the `preferThirdPartyAuthentication()` block and before the `CI` branch:
  ```typescript
  if (isVsCodeProxy() && apiKeyEnv) {
    return { key: apiKeyEnv, source: 'ANTHROPIC_API_KEY' }
  }
  ```
  This returns the env-var key directly, bypassing the `customApiKeyResponses.approved` list gate. No prefix validation — `isVsCodeProxy()` being true is sufficient trust signal.

### Auth Source Bypass (`getAuthTokenSource`)
- **D-02:** In `getAuthTokenSource()` (`src/utils/auth.ts` line ~188), add a branch immediately after the `ANTHROPIC_AUTH_TOKEN` check:
  ```typescript
  if (isVsCodeProxy() && process.env.ANTHROPIC_API_KEY) {
    return { source: 'ANTHROPIC_API_KEY' as const, hasToken: true }
  }
  ```
  This prevents the function from falling through to OAuth token lookups and returning `{source: 'none', hasToken: false}`.

### Approval Dialog Skip (`Onboarding.tsx`)
- **D-03:** In `src/components/Onboarding.tsx` around line 105, add a guard before the `getCustomApiKeyStatus()` check:
  ```typescript
  if (isVsCodeProxy()) {
    // VS Code proxy injects a new vscode-lm-* token each session — no approval needed
    return undefined  // or skip the customApiKeyTruncated assignment
  }
  ```
  This prevents the "Approve this API key?" dialog from appearing every new VS Code session (new token = not in approved list = would prompt every time).

### No Changes to `isValidApiKey / saveApiKey`
- **D-04:** `isValidApiKey()` (line 1116) and `saveApiKey()` are only called when saving a key interactively. VS Code tokens are never saved — they're session-ephemeral env vars. No bypass needed in this path.

### Bypass Condition
- **D-05:** The bypass condition in all three locations is `isVsCodeProxy()` only — no additional `vscode-lm-` prefix check. `isVsCodeProxy()` already validates all three VS Code env signals. Adding a prefix check would be redundant and would break if the token format changes.

### Claude's Discretion
- Exact placement within each function (immediately after the chosen anchor, or at top of non-bare path)
- Whether to add JSDoc comments on the bypass guards (follow existing style)
- Whether to add a test case in `auth.test.ts` to cover the bypass path

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth core
- `src/utils/auth.ts` lines 178–231 — `getAuthTokenSource()` full function body (OAuth cascade to bypass)
- `src/utils/auth.ts` lines 251–375 — `getAnthropicApiKeyWithSource()` full function body (approved-list gate to bypass)
- `src/utils/auth.ts` lines 91–119 — `isManagedOAuthContext()` and `isVsCodeProxy()` — the detection helpers; use as pattern

### Approval dialog
- `src/components/Onboarding.tsx` lines 100–135 — custom API key approval step (location to add guard)
- `src/components/ApproveApiKey.tsx` — full component (understand what's being skipped)

### Requirements
- `.planning/REQUIREMENTS.md` AUTO-02, AUTO-03 — the two requirements this phase delivers

### Phase 1 context
- `.planning/phases/01-proxy-detection-feedback/01-CONTEXT.md` — `isVsCodeProxy()` decisions (D-01 through D-08)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `isVsCodeProxy()` at `src/utils/auth.ts:105` — already exported, pure, synchronous. Import and call directly.
- `isManagedOAuthContext()` at `src/utils/auth.ts:91` — structural pattern to follow for bypass guards

### Established Patterns
- Both `getAuthTokenSource()` and `getAnthropicApiKeyWithSource()` use early-return cascades — new bypass guards fit naturally as additional early returns
- `normalizeApiKeyForConfig(apiKey)` returns `apiKey.slice(-20)` — VS Code token's last 20 chars are fine as normalized form but won't be in approved list (by design: we bypass before that check)

### Integration Points
- `src/utils/auth.ts` — all three bypass guards are in this file; import `isVsCodeProxy` is already present (added in Phase 1 for the function, but the import needs to be verified for the bypass call sites)
- `src/components/Onboarding.tsx` — needs `isVsCodeProxy` imported from `../utils/auth.js`
- `src/main.tsx` — already imports `isVsCodeProxy` from `./utils/auth.js` (added in Phase 1); no additional changes needed in main.tsx for this phase

</code_context>

<specifics>
## Specific Ideas

- The `vscode-lm-*` token contains a dot (`.`) between two UUID segments, which would fail `isValidApiKey()`'s `/^[a-zA-Z0-9-_]+$/` regex — but this code path is never reached for env-var tokens, only for `saveApiKey()`. Confirming no change needed to `isValidApiKey()`.
- The approved-list check at line 326–335 uses `normalizeApiKeyForConfig(apiKeyEnv)` (last 20 chars). The VS Code token's last 20 chars change each session — so the key can't be persistently approved. The bypass in D-01 sidesteps this entirely (no approval needed for proxy sessions).
- `getAuthTokenSource()` does NOT check `ANTHROPIC_API_KEY` at all — it exclusively looks for OAuth/authToken sources. The D-02 bypass adds this missing check for the proxy case.

</specifics>

<deferred>
## Deferred Ideas

- Adding VS Code proxy detection to telemetry/GrowthBook attributes — noted from Phase 1, still deferred
- Detection for other editors (Cursor) — out of scope for v1

</deferred>

---

*Phase: 02-token-validation-bypass*
*Context gathered: 2026-04-06*
