# Phase 3: Provider Profile Fallback - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 03-provider-profile-fallback
**Mode:** auto (all gray areas auto-selected, recommended options chosen)
**Areas discussed:** CLI Flag Name, Activation Mechanism, Default base_url, Provider Listing

---

## CLI Flag Name

| Option | Description | Selected |
|--------|-------------|----------|
| `--provider vscode` | Consistent with existing VALID_PROVIDERS infrastructure in providerFlag.ts | ✓ |
| `--profile vscode` | As written in ROADMAP, but no `--profile` flag exists in the codebase | |

**Auto-selected:** `--provider vscode`
**Notes:** ROADMAP says `--profile` but the actual CLI handler is `--provider`. Using the existing flag system is the minimal, non-breaking path.

---

## Activation Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Set VS Code env signals in applyProviderFlag | Set `CLAUDE_CODE_ENTRYPOINT='sdk-ts'` + `CLAUDECODE='1'` so `isVsCodeProxy()` returns true — Phase 2 guards fire naturally | ✓ |
| New bypass condition | Extend bypass guards in auth.ts to check for a new env var (e.g., `CLAUDE_CODE_USE_VSCODE`) | |
| Token prefix check | Check `ANTHROPIC_API_KEY.startsWith('vscode-lm-')` as activation | |

**Auto-selected:** Set VS Code env signals — activates isVsCodeProxy() naturally
**Notes:** Zero changes needed to auth.ts in Phase 3. All Phase 2 guards fire automatically.

---

## Default base_url

| Option | Description | Selected |
|--------|-------------|----------|
| Rely on user-set ANTHROPIC_BASE_URL | No hardcoded default — user must set env var or use inside VS Code | ✓ |
| Hardcode a common default port | e.g., http://localhost:57760 — but port is dynamic, would be wrong most of the time | |
| Interactive prompt for port | Ask user for port number when --provider vscode is invoked without ANTHROPIC_BASE_URL | |

**Auto-selected:** Rely on user-set ANTHROPIC_BASE_URL
**Notes:** VS Code port is dynamic per session — hardcoding is wrong. Users who use `--provider vscode` outside VS Code must set ANTHROPIC_BASE_URL manually.

---

## Provider Listing

| Option | Description | Selected |
|--------|-------------|----------|
| Description-only entry (no TUI flow) | Add `vscode` to VALID_PROVIDERS + description string; no interactive setup wizard | ✓ |
| Full interactive setup flow | Wizard that asks for base_url and api_key — matches how openai/gemini are set up | |

**Auto-selected:** Description-only entry
**Notes:** VS Code injects credentials; no interactive setup needed for v1. PROF-03 requirement satisfied with a description string.

---

## Claude's Discretion

- Exact placement of `vscode` in VALID_PROVIDERS array
- Whether to add a warning when ANTHROPIC_BASE_URL is not set with --provider vscode
- Test coverage scope for providerFlag.test.ts additions
- How to surface the vscode option in the /provider command listing

## Deferred Ideas

- Persistent vscode profile in .openclaude-profile.json — token is ephemeral, persistence is incompatible
- Interactive /provider setup wizard for base_url + api_key inputs
- Support for Cursor or other editors
