# Requirements: OpenClaude VS Code Integration

**Defined:** 2026-04-06
**Core Value:** `openclaude` funciona no terminal do VS Code com Copilot Pro+ sem configuração adicional

## v1 Requirements

### Auto-Detection

- [ ] **AUTO-01**: OpenClaude detecta a presença de `ANTHROPIC_BASE_URL` apontando para localhost e ativa modo VS Code proxy automaticamente
- [x] **AUTO-02**: OpenClaude aceita tokens no formato `vscode-lm-*` como `ANTHROPIC_API_KEY` válido (sem rejeitar por formato)
- [x] **AUTO-03**: No modo VS Code proxy, OpenClaude não tenta validar/renovar o token via fluxo OAuth da Anthropic
- [ ] **AUTO-04**: OpenClaude exibe mensagem informativa quando detecta o proxy do VS Code (ex: "Using VS Code Claude Code proxy")

### Provider Profile

- [x] **PROF-01**: Exists um provider profile `vscode` configurável via `/provider` ou `--profile vscode`
- [x] **PROF-02**: O profile `vscode` permite sobrescrever `base_url` e `api_key` manualmente como fallback
- [x] **PROF-03**: O profile `vscode` é listado nas opções de provider com descrição clara

### Build & Distribution

- [ ] **DIST-01**: Mudanças no código-fonte são compiladas (`bun run build`) e o binário global atualizado
- [ ] **DIST-02**: `openclaude --version` reporta versão correta após atualização

### Documentation

- [ ] **DOCS-01**: README contém seção "VS Code / GitHub Copilot Pro+" com instruções de uso
- [ ] **DOCS-02**: Instruções incluem como verificar se a integração está funcionando

## v2 Requirements

### Persistência & Automação

- **PERS-01**: Script helper que captura os env vars do VS Code e os salva para uso fora do VS Code
- **PERS-02**: Integração com VS Code tasks para lançar `openclaude` com env vars corretos automaticamente

### Outros Editores

- **EDIT-01**: Suporte equivalente para Cursor (detecta proxy do Cursor automaticamente)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Persistência de token sem VS Code aberto | Token é dinâmico — invalida quando VS Code fecha |
| Modificar proxy do VS Code | Fora do controle do projeto |
| Suporte a Cursor/outros editores (v1) | Foco no VS Code neste milestone |
| Autenticação Anthropic separada | Usuário não tem plano Anthropic pago |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTO-01 | Phase 1 — Proxy Detection & Feedback | Pending |
| AUTO-04 | Phase 1 — Proxy Detection & Feedback | Pending |
| AUTO-02 | Phase 2 — Token Validation Bypass | Complete |
| AUTO-03 | Phase 2 — Token Validation Bypass | Complete |
| PROF-01 | Phase 3 — Provider Profile Fallback | Complete |
| PROF-02 | Phase 3 — Provider Profile Fallback | Complete |
| PROF-03 | Phase 3 — Provider Profile Fallback | Complete |
| DIST-01 | Phase 4 — Build & Smoke Test | Pending |
| DIST-02 | Phase 4 — Build & Smoke Test | Pending |
| DOCS-01 | Phase 5 — Documentation | Pending |
| DOCS-02 | Phase 5 — Documentation | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after roadmap revision (3 phases → 5 phases)*
