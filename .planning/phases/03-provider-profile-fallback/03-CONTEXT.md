# Phase 3: Provider Profile Fallback - Context

**Gathered:** 2026-04-06 (auto mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a `vscode` entry to the `--provider` flag system so users can explicitly activate VS Code proxy mode with `openclaude --provider vscode` when env vars are NOT automatically injected by the terminal. This is the manual fallback for non-terminal environments (scripts, remote sessions, shells without VS Code env injection).

</domain>

<decisions>
## Implementation Decisions

### CLI Flag Name
- **D-01:** Use `--provider vscode` (NOT `--profile vscode`). The existing CLI handler is `--provider` (`src/utils/providerFlag.ts:VALID_PROVIDERS`). Adding `vscode` to `VALID_PROVIDERS` and `applyProviderFlag()` is the minimal, consistent path. No new `--profile` flag alias needed.

### Activation Mechanism (critical design decision)
- **D-02:** `applyProviderFlag('vscode')` sets `CLAUDE_CODE_ENTRYPOINT='sdk-ts'` and `CLAUDECODE='1'` in `process.env`. This makes `isVsCodeProxy()` (Phase 1) return `true`, which in turn fires the Phase 2 bypass guards (`getAuthTokenSource`, `getAnthropicApiKeyWithSource`, Onboarding guard) automatically. No additional auth changes needed in Phase 3.
- **D-03:** `applyProviderFlag('vscode')` does NOT change `ANTHROPIC_BASE_URL` — the user must provide it via env var. If `ANTHROPIC_BASE_URL` is not set when `--provider vscode` is used, the session will use the default Anthropic API URL (which will fail gracefully — same behavior as any misconfigured proxy). A guidance message is acceptable but not required.
- **D-04:** `applyProviderFlag('vscode')` does NOT change `ANTHROPIC_API_KEY` — it passes through whatever the user has set (or VS Code injected). No synthetic placeholder value.

### ProviderProfile Type
- **D-05:** `vscode` is NOT added to the `ProviderProfile` union type in `providerProfile.ts` (which controls `.openclaude-profile.json` persistence). The VS Code token is session-ephemeral and must never be persisted. The `vscode` profile lives only in the `VALID_PROVIDERS` flag system (providerFlag.ts) — it is a flag-only provider, not a persistable profile.

### Provider Listing Description
- **D-06:** Add `vscode` to `VALID_PROVIDERS` in `providerFlag.ts` with a descriptive comment: `// VS Code Claude Code proxy — routes through GitHub Copilot Pro+`.
- **D-07:** The `/provider` command description string for `vscode`: `"VS Code Claude Code proxy — routes api calls through GitHub Copilot Pro+"`. No interactive setup flow needed (credentials are injected by VS Code or set manually via env).

### Claude's Discretion
- Whether to add a validation check that warns user when `ANTHROPIC_BASE_URL` is not set after applying `--provider vscode`
- Exact placement of `vscode` in the VALID_PROVIDERS list (alphabetical or at end)
- Whether to add a test in `providerFlag.test.ts` for the `vscode` case

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Provider flag system
- `src/utils/providerFlag.ts` — `VALID_PROVIDERS`, `applyProviderFlag()`, `parseProviderFlag()`. THIS is where `vscode` must be added. Read the full file before editing.
- `src/utils/providerFlag.test.ts` — Existing test patterns for provider flag application. Mirror these for the `vscode` case.

### Provider profile persistence (do NOT use for vscode)
- `src/utils/providerProfile.ts` — `ProviderProfile` type and `buildLaunchEnv()`. The `vscode` profile must NOT be added here (token must not be persisted). Read to understand the boundary.

### Provider listing UI
- `src/commands/provider/provider.tsx` — Where the `/provider` command renders profile choices. The `vscode` entry should appear in the listing with its description. Read the `ProviderChoice` type and how options are built.

### Phase 2 bypass guards (already implemented — DO NOT re-implement)
- `src/utils/auth.ts` lines ~192–198 — D-02 guard in `getAuthTokenSource()` (fires when `isVsCodeProxy()` is true)
- `src/utils/auth.ts` lines ~295–301 — D-01 guard in `getAnthropicApiKeyWithSource()` (fires when `isVsCodeProxy()` is true)
- `src/components/Onboarding.tsx` line ~106 — D-03 guard (fires when `isVsCodeProxy()` is true)
- All three guards trigger automatically once D-02 of this phase sets `CLAUDE_CODE_ENTRYPOINT='sdk-ts'` and `CLAUDECODE='1'`

### Requirements
- `.planning/REQUIREMENTS.md` PROF-01, PROF-02, PROF-03 — The three requirements this phase delivers

### Prior phase context
- `.planning/phases/02-token-validation-bypass/02-CONTEXT.md` — Phase 2 bypass guard decisions (especially D-05: `isVsCodeProxy()` is the sole trust signal)
- `.planning/phases/01-proxy-detection-feedback/01-CONTEXT.md` — `isVsCodeProxy()` implementation details

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `applyProviderFlag()` in `src/utils/providerFlag.ts:70` — Direct pattern to extend. The `vscode` case is a new `case 'vscode':` in the switch statement.
- `isVsCodeProxy()` in `src/utils/auth.ts:105` — Already exported and used. Setting its three required env vars in `applyProviderFlag('vscode')` is the activation mechanism.

### Established Patterns
- Every provider in `VALID_PROVIDERS` maps to a `case` in `applyProviderFlag()`'s switch
- Providers that need no OPENAI_* vars (like `anthropic`) just have an empty `break` — `vscode` follows the same pattern but sets Anthropic-context env vars instead
- The `/provider` command uses `ProviderChoice = 'auto' | ProviderProfile | 'clear'` — if `vscode` is NOT added to `ProviderProfile`, it cannot appear as a persisted profile choice (correct behavior)

### Integration Points
- `src/utils/providerFlag.ts` — Only file that needs modification: add `'vscode'` to `VALID_PROVIDERS` and a `case 'vscode'` to `applyProviderFlag()`
- `src/commands/provider/provider.tsx` — May need a description entry for `vscode` in the Select options list (PROF-03)
- `src/components/ProviderManager.tsx` — Possibly where provider descriptions are rendered; read before editing provider.tsx

</code_context>

<specifics>
## Specific Ideas

- The `applyProviderFlag('vscode')` implementation should be minimal:
  ```typescript
  case 'vscode':
    // Activate VS Code proxy signals so isVsCodeProxy() returns true
    process.env.CLAUDE_CODE_ENTRYPOINT ??= 'sdk-ts'
    process.env.CLAUDECODE ??= '1'
    // ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY are user-provided or injected by VS Code
    break
  ```
- `??=` (nullish assignment) preserves existing values — if VS Code already injected them, they're left unchanged

</specifics>

<deferred>
## Deferred Ideas

- Persistent VS Code profile in `.openclaude-profile.json` — Token is ephemeral, persistence is fundamentally incompatible (per Phase 2 D-05 and project constraints)
- Interactive `/provider` setup flow for `vscode` (asking user for base_url + api_key) — Phase 5 documentation covers manual env var setup; an interactive flow is over-engineering for v1
- Support for other editors (Cursor with similar proxy) — Out of scope for v1

</deferred>

---

*Phase: 03-provider-profile-fallback*
*Context gathered: 2026-04-06*
