# Roadmap: OpenClaude VS Code GitHub Copilot Integration

## Overview

v1 — VS Code Proxy Integration delivers native support for the VS Code Claude Code proxy in 5 sequential phases. The root problem is that OpenClaude's auth layer rejects the `vscode-lm-*` token format VS Code injects into the terminal. Phase 1 adds explicit proxy detection and user feedback. Phase 2 builds on that detection to bypass token validation and OAuth. Phase 3 adds a named `vscode` provider profile for explicit fallback. Phase 4 compiles and verifies everything end-to-end. Phase 5 documents the integration so users can discover and confirm it.

## Milestones

- 🚧 **v1 — VS Code Proxy Integration** - Phases 1–5 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Proxy Detection & Feedback** - Detect VS Code proxy env vars and confirm proxy mode to the user
- [ ] **Phase 2: Token Validation Bypass** - Accept `vscode-lm-*` tokens and skip OAuth when proxy is detected
- [ ] **Phase 3: Provider Profile Fallback** - Add explicit `vscode` provider profile for manual activation
- [ ] **Phase 4: Build & Smoke Test** - Compile all changes and verify the global binary end-to-end
- [ ] **Phase 5: Documentation** - Document the integration so users can set it up and verify it works

## Phase Details

### Phase 1: Proxy Detection & Feedback
**Goal**: `openclaude` identifies when it is running inside the VS Code Claude Code proxy environment and communicates this to the user before any auth decisions are made
**Depends on**: Nothing (first phase)
**Requirements**: AUTO-01, AUTO-04
**Success Criteria** (what must be TRUE):
  1. When `ANTHROPIC_BASE_URL=http://localhost:<PORT>` is present in the environment, `openclaude` activates VS Code proxy mode automatically without any user action
  2. The terminal displays a clear informative message (e.g., "Using VS Code Claude Code proxy") confirming proxy mode is active
  3. Detection works for any dynamic port — not hardcoded to a specific port number
  4. When the proxy env vars are absent, behavior is identical to before — no regression on normal Anthropic API or other provider flows
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Implement `isVsCodeProxy()` detection function in `src/utils/auth.ts`
- [x] 01-02-PLAN.md — Wire detection into startup path, print proxy confirmation message
**UI hint**: no

### Phase 2: Token Validation Bypass
**Goal**: `openclaude` accepts `vscode-lm-*` tokens without error and does not trigger any OAuth or Anthropic credential validation when running behind the VS Code proxy
**Depends on**: Phase 1
**Requirements**: AUTO-02, AUTO-03
**Success Criteria** (what must be TRUE):
  1. Starting `openclaude` in VS Code's integrated terminal does not produce an "invalid API key" or token format rejection error
  2. A `vscode-lm-*` value passed as `ANTHROPIC_API_KEY` passes auth validation without modification or error
  3. When proxy mode is detected (from Phase 1), no OAuth flow, token renewal, or Anthropic credential check is attempted
  4. The existing auth paths for standard Anthropic API keys and OAuth are unaffected — no regressions
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — Add bypass guards to `getAuthTokenSource()` and `getAnthropicApiKeyWithSource()` in `src/utils/auth.ts` with TDD test coverage
- [ ] 02-02-PLAN.md — Add `isVsCodeProxy()` guard to `Onboarding.tsx` `apiKeyNeedingApproval` memo to suppress approval dialog in proxy sessions
**UI hint**: no

### Phase 3: Provider Profile Fallback
**Goal**: Users can explicitly activate VS Code proxy mode via `openclaude --profile vscode` when env vars are not automatically injected by the terminal
**Depends on**: Phase 2
**Requirements**: PROF-01, PROF-02, PROF-03
**Success Criteria** (what must be TRUE):
  1. `openclaude --profile vscode` launches using VS Code proxy settings without requiring `ANTHROPIC_BASE_URL` or `ANTHROPIC_API_KEY` env vars to be set
  2. The `vscode` profile accepts manual overrides for `base_url` and `api_key` to support non-standard proxy configurations
  3. Running `/provider` or the provider selection UI lists the `vscode` profile with a description that explains it routes through the VS Code Claude Code proxy
**Plans**: TBD

Plans:
- [ ] 03-01: Add `vscode` profile definition to `src/utils/providerProfiles.ts` with default `base_url` handling and `api_key` passthrough
- [ ] 03-02: Register `--profile vscode` CLI flag and `/provider vscode` command routing in the CLI entrypoint (`bin/openclaude`)
- [ ] 03-03: Add human-readable description string for the `vscode` profile in the provider listing
**UI hint**: no

### Phase 4: Build & Smoke Test
**Goal**: All source changes from Phases 1–3 are compiled into a working binary and verified correct on the local machine before documentation is written
**Depends on**: Phase 3
**Requirements**: DIST-01, DIST-02
**Success Criteria** (what must be TRUE):
  1. `bun run build` completes without errors and produces `dist/cli.mjs` incorporating all Phase 1–3 changes
  2. `npm install -g` installs the updated binary cleanly
  3. `openclaude --version` reports the correct updated version number after global reinstall
  4. A manual test inside VS Code's integrated terminal confirms the proxy message appears and a session starts without token rejection errors
**Plans**: TBD

Plans:
- [ ] 04-01: Bump version in `package.json`, run `bun run build`, install globally with `npm install -g`, verify with `openclaude --version`
- [ ] 04-02: Run `bun run smoke` and execute a manual end-to-end verification inside VS Code terminal with Copilot Pro+ active
**UI hint**: no

### Phase 5: Documentation
**Goal**: Users can discover, understand, and independently verify the VS Code integration using only the project README
**Depends on**: Phase 4
**Requirements**: DOCS-01, DOCS-02
**Success Criteria** (what must be TRUE):
  1. The README contains a dedicated "VS Code / GitHub Copilot Pro+" section covering prerequisites, how auto-detection works, and the `--profile vscode` fallback
  2. The section includes a step-by-step verification checklist so users can confirm the integration is active and working correctly
  3. A user with no prior knowledge of the project can follow the README alone to go from zero to a working `openclaude` session in VS Code
**Plans**: TBD

Plans:
- [ ] 05-01: Write "VS Code / GitHub Copilot Pro+" section in README — prerequisites, auto-detection behavior, `--profile vscode` fallback usage
- [ ] 05-02: Add verification checklist to README — proxy message confirmation, `openclaude --version` check, session start confirmation
**UI hint**: no

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Proxy Detection & Feedback | 2/2 | Complete | 2026-04-06 |
| 2. Token Validation Bypass | 0/2 | Not started | - |
| 3. Provider Profile Fallback | 0/3 | Not started | - |
| 4. Build & Smoke Test | 0/2 | Not started | - |
| 5. Documentation | 0/2 | Not started | - |

---

## Requirements Traceability

**Milestone:** v1 — VS Code Proxy Integration
**Coverage:** 11/11 v1 requirements mapped

| Requirement | Description | Phase | Status |
|-------------|-------------|-------|--------|
| AUTO-01 | Detect `ANTHROPIC_BASE_URL` pointing to localhost and activate proxy mode automatically | Phase 1 | Done |
| AUTO-04 | Display informative message when VS Code proxy is detected | Phase 1 | Done |
| AUTO-02 | Accept `vscode-lm-*` tokens as `ANTHROPIC_API_KEY` without rejection | Phase 2 | Pending |
| AUTO-03 | Skip OAuth validation when running in VS Code proxy mode | Phase 2 | Pending |
| PROF-01 | `vscode` provider profile available via `/provider` or `--profile vscode` | Phase 3 | Pending |
| PROF-02 | `vscode` profile allows manual override of `base_url` and `api_key` | Phase 3 | Pending |
| PROF-03 | `vscode` profile listed in provider options with a clear description | Phase 3 | Pending |
| DIST-01 | Source changes compiled with `bun run build` and global binary updated | Phase 4 | Pending |
| DIST-02 | `openclaude --version` reports correct version after update | Phase 4 | Pending |
| DOCS-01 | README contains "VS Code / GitHub Copilot Pro+" section with usage instructions | Phase 5 | Pending |
| DOCS-02 | Instructions include how to verify the integration is working | Phase 5 | Pending |

---
*Roadmap initialized: 2026-04-06*
*Milestone: v1 — VS Code Proxy Integration*
