# Roadmap: OpenClaude VS Code GitHub Copilot Integration

## Overview

This roadmap delivers native VS Code Claude Code proxy support to OpenClaude in three focused phases. Phase 1 implements the core value: automatic detection and transparent passthrough of VS Code's injected env vars so `openclaude` just works. Phase 2 adds an explicit `vscode` provider profile for environments where auto-detection isn't available. Phase 3 packages and documents the integration so users can discover, install, and verify it.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: VS Code Proxy Auto-Detection** - Auto-detect VS Code's injected proxy env vars and route transparently
- [ ] **Phase 2: Provider Profile Fallback** - Explicit `vscode` profile for when env vars aren't automatically present
- [ ] **Phase 3: Build, Distribution & Documentation** - Package and document the integration for users

## Phase Details

### Phase 1: VS Code Proxy Auto-Detection
**Goal**: `openclaude` automatically detects and uses the VS Code Claude Code proxy without any user configuration
**Depends on**: Nothing (first phase)
**Requirements**: AUTO-01, AUTO-02, AUTO-03, AUTO-04
**Success Criteria** (what must be TRUE):
  1. Running `openclaude` inside VS Code's integrated terminal with Copilot Pro+ active works without any manual setup or separate API key
  2. `vscode-lm-*` format API keys are accepted without rejection or validation errors
  3. No OAuth flow or token renewal attempt is triggered when `ANTHROPIC_BASE_URL` pointing to localhost is present
  4. The terminal displays an informative message confirming VS Code proxy mode is active (e.g., "Using VS Code Claude Code proxy")
**Plans**: TBD

### Phase 2: Provider Profile Fallback
**Goal**: Users can explicitly activate VS Code proxy mode via a named profile when env vars are not automatically present
**Depends on**: Phase 1
**Requirements**: PROF-01, PROF-02, PROF-03
**Success Criteria** (what must be TRUE):
  1. `openclaude --profile vscode` launches the tool in VS Code proxy mode without requiring env vars to be set
  2. The `vscode` profile accepts manual overrides for `base_url` and `api_key` for non-standard setups
  3. The `vscode` profile appears in the provider listing with a description that explains what it does
**Plans**: TBD

### Phase 3: Build, Distribution & Documentation
**Goal**: The integration is packaged for distribution and users can understand, install, and verify it works
**Depends on**: Phase 2
**Requirements**: DIST-01, DIST-02, DOCS-01, DOCS-02
**Success Criteria** (what must be TRUE):
  1. `openclaude --version` displays the correct updated version number after running `bun run build` and reinstalling globally
  2. The README contains a "VS Code / GitHub Copilot Pro+" section with clear setup and usage instructions
  3. Users can follow documented verification steps to confirm the integration is active and working correctly
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. VS Code Proxy Auto-Detection | 0/TBD | Not started | - |
| 2. Provider Profile Fallback | 0/TBD | Not started | - |
| 3. Build, Distribution & Documentation | 0/TBD | Not started | - |
