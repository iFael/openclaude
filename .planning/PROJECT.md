# OpenClaude — VS Code GitHub Copilot Integration

## What This Is

OpenClaude é um CLI de agente de código aberto que suporta múltiplos providers (OpenAI, Gemini, Ollama, etc.). Este projeto adiciona suporte nativo ao proxy local do VS Code Claude Code, permitindo que usuários com GitHub Copilot Pro+ usem o `openclaude` no terminal sem precisar de uma conta paga na Anthropic.

## Core Value

Quando o usuário abre o terminal dentro do VS Code com Claude Code ativo, `openclaude` funciona imediatamente — sem configuração, sem API key separada, usando o GitHub Copilot Pro+ do usuário.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] OpenClaude detecta automaticamente as variáveis `ANTHROPIC_API_KEY=vscode-lm-*` e `ANTHROPIC_BASE_URL=http://localhost:PORT` injetadas pelo VS Code
- [ ] OpenClaude aceita tokens no formato `vscode-lm-*` sem rejeitar como inválidos
- [ ] Provider profile explícito `vscode` disponível como fallback (`openclaude --profile vscode`)
- [ ] Comando `openclaude` funciona corretamente a partir do terminal integrado do VS Code com Copilot Pro+
- [ ] Documentação clara de como configurar e usar a integração

### Out of Scope

- Persistência de token entre sessões sem VS Code aberto — token é dinâmico e vinculado à sessão
- Suporte a outros editores (Cursor, Neovim etc.) — foco no VS Code neste milestone
- Modificar o comportamento do proxy do VS Code em si

## Context

- O VS Code com Claude Code ativo injeta automaticamente dois env vars no terminal integrado:
  - `ANTHROPIC_API_KEY=vscode-lm-8540fd7f-b152-4f7e-bfa8-6cbeb8f2e5b2.d8e0ea0b-e99e-4db5-a07b-29f411f45cf4`
  - `ANTHROPIC_BASE_URL=http://localhost:57760`
  - `CLAUDE_CODE_ENTRYPOINT=sdk-ts` e `CLAUDECODE=1`
- O proxy local do VS Code (porta dinâmica) traduz chamadas Anthropic para usar o GitHub Copilot Pro+
- OpenClaude é fork do Claude Code oficial — base de código TypeScript/Bun, `src/` contém a lógica de auth
- A auth Anthropic está em `src/utils/auth.ts` — função `getAuthTokenSource()` valida o API key
- O projeto usa Bun como runtime e bundler (`bun run build` → `dist/cli.mjs`)
- Instalado globalmente via npm: `npm install -g @gitlawb/openclaude` → comando `openclaude`

## Constraints

- **Compatibilidade**: Não quebrar flows existentes (Anthropic API key, OAuth, outros providers)
- **Token dinâmico**: `ANTHROPIC_BASE_URL` e `ANTHROPIC_API_KEY` mudam a cada sessão do VS Code — não devem ser hardcoded
- **Validação do token**: Código atual pode rejeitar `vscode-lm-*` como formato inválido — precisa de bypass condicional
- **Build**: Qualquer mudança no `src/` requer `bun run build` + `npm install -g` para atualizar o binário global

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Auto-detecção via env vars | Mais simples e sem config — funciona transparentemente no terminal do VS Code | — Pending |
| Provider profile `vscode` como fallback | Permite uso explícito fora do terminal do VS Code quando env vars não estão presentes | — Pending |
| Não persistir token | Token dinâmico não faz sentido persistir — a cada sessão o VS Code injeta um novo | — Pending |

## Evolution

Este documento evolui a cada transição de fase e milestone.

**Após cada fase:**
1. Requirements invalidados? → Mover para Out of Scope
2. Requirements validados? → Mover para Validated
3. Novos requirements? → Adicionar a Active
4. Decisões a registrar? → Adicionar a Key Decisions

**Após cada milestone:**
1. Revisão completa de todas as seções
2. Core Value ainda correto?
3. Out of Scope — razões ainda válidas?

---
*Last updated: 2026-04-06 after initialization*
