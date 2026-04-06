# Phase 1: Proxy Detection & Feedback - Context

**Gathered:** 2026-04-06 (auto mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Detect when `openclaude` is running inside the VS Code Claude Code proxy environment and display an informative message to the user before any auth decisions are made. This phase does NOT change auth validation or token acceptance — that is Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Detection Criteria
- **D-01:** `isVsCodeProxy()` returns `true` when ALL three conditions hold: `ANTHROPIC_BASE_URL` is set to a `localhost` URL (any port) AND `CLAUDE_CODE_ENTRYPOINT === 'sdk-ts'` AND `CLAUDECODE === '1'`
- **D-02:** Port-agnostic detection — check `new URL(ANTHROPIC_BASE_URL).hostname === 'localhost'`, not a specific port number
- **D-03:** The function must be pure and synchronous — no I/O, no side effects

### Function Location
- **D-04:** `isVsCodeProxy()` lives in `src/utils/auth.ts`, immediately after `isManagedOAuthContext()` (line ~95). This keeps all context-detection helpers together and allows Phase 2 to re-use it without imports from elsewhere.

### Startup Message Injection Point
- **D-05:** The detection message is printed in `src/main.tsx` in the entrypoint-detection block (around line 520–540), right after `process.env.CLAUDE_CODE_ENTRYPOINT` is resolved. This mirrors the existing pattern where startup context is established before session initialization.
- **D-06:** Use `process.stderr.write(...)` — consistent with every other startup diagnostic in `main.tsx` (errors, warnings, build checks all go to stderr)

### Message Format
- **D-07:** Single-line message: `"Using VS Code Claude Code proxy (GitHub Copilot Pro+)\n"` — no chalk color, no box, no banner. Minimal, functional, consistent with the project's existing startup diagnostic style.
- **D-08:** Only print when `isVsCodeProxy()` returns `true` AND the session is interactive (not `--bare`, not `--print`/`-p` headless mode)

### Claude's Discretion
- Exact import path adjustments if needed when adding `isVsCodeProxy` export to auth.ts
- Whether to add a JSDoc comment to the function (follow existing style in auth.ts)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth utilities
- `src/utils/auth.ts` — Location for `isVsCodeProxy()`. Read `isManagedOAuthContext()` (line ~88–97) as the direct pattern to follow: same structure, same pure-function style.

### Startup entrypoint
- `src/main.tsx` lines 515–545 — Entrypoint detection block where `CLAUDE_CODE_ENTRYPOINT` is read and set. This is where the detection message must be injected.
- `src/main.tsx` lines 440–495 — Existing `process.stderr.write` patterns for startup diagnostics (format to match).

### Requirements
- `.planning/REQUIREMENTS.md` AUTO-01, AUTO-04 — The two requirements this phase delivers.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `isManagedOAuthContext()` in `src/utils/auth.ts:88` — Direct template for `isVsCodeProxy()`. Same pattern: reads `process.env.*`, returns boolean, no side effects.
- `getApiBaseUrlHost()` in `src/services/analytics/growthbook.ts:441` — Already parses `ANTHROPIC_BASE_URL` with `new URL()` + `.host`. The `localhost` check is `new URL(baseUrl).hostname === 'localhost'`.

### Established Patterns
- All startup diagnostics in `main.tsx` use `process.stderr.write(chalk.red/yellow/cyan(...))` or plain `process.stderr.write(...)` — no custom Logger, no React component.
- Context-detection booleans (`isBareMode`, `isManagedOAuthContext`, `isEnvTruthy`) live in `src/utils/auth.ts` and `src/bootstrap/state.ts`, exported individually.

### Integration Points
- `main.tsx:520` — After `if (process.env.CLAUDE_CODE_ENTRYPOINT)` early-return block AND before `process.env.CLAUDE_CODE_ENTRYPOINT = isNonInteractive ? 'sdk-cli' : 'cli'` assignment. Insert the detection and message here so it fires when the VS Code-injected `CLAUDE_CODE_ENTRYPOINT=sdk-ts` is present.
- `src/utils/auth.ts` — Import `isVsCodeProxy` from here into `main.tsx` (same import pattern as `isBareMode`, `preferThirdPartyAuthentication`)

</code_context>

<specifics>
## Specific Ideas

- `CLAUDE_CODE_ENTRYPOINT === 'sdk-ts'` is already the value VS Code injects (confirmed from live env capture in conversation: `CLAUDE_CODE_ENTRYPOINT=sdk-ts`)
- `CLAUDECODE=1` is also injected by VS Code (confirmed from live env)
- The proxy port is dynamic (57760 observed, but changes per session) — must NOT hardcode it
- No chalk color on the message — keep it neutral (not red/yellow which imply errors)

</specifics>

<deferred>
## Deferred Ideas

- Adding the VS Code proxy detection to telemetry/analytics attributes (GrowthBook) — Phase 2 or later
- Detection for other editors (Cursor) — Out of scope for v1

</deferred>

---

*Phase: 01-proxy-detection-feedback*
*Context gathered: 2026-04-06*
