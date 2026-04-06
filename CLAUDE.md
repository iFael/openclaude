<!-- GSD:project-start source:PROJECT.md -->
## Project

**OpenClaude — VS Code GitHub Copilot Integration**

OpenClaude é um CLI de agente de código aberto que suporta múltiplos providers (OpenAI, Gemini, Ollama, etc.). Este projeto adiciona suporte nativo ao proxy local do VS Code Claude Code, permitindo que usuários com GitHub Copilot Pro+ usem o `openclaude` no terminal sem precisar de uma conta paga na Anthropic.

**Core Value:** Quando o usuário abre o terminal dentro do VS Code com Claude Code ativo, `openclaude` funciona imediatamente — sem configuração, sem API key separada, usando o GitHub Copilot Pro+ do usuário.

### Constraints

- **Compatibilidade**: Não quebrar flows existentes (Anthropic API key, OAuth, outros providers)
- **Token dinâmico**: `ANTHROPIC_BASE_URL` e `ANTHROPIC_API_KEY` mudam a cada sessão do VS Code — não devem ser hardcoded
- **Validação do token**: Código atual pode rejeitar `vscode-lm-*` como formato inválido — precisa de bypass condicional
- **Build**: Qualquer mudança no `src/` requer `bun run build` + `npm install -g` para atualizar o binário global
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
