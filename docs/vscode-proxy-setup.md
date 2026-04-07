# OpenClaude — Guia de Configuracao com VS Code Proxy (Copilot Pro+)

Este documento explica como configurar o OpenClaude para funcionar com o proxy do VS Code,
permitindo usar modelos Claude no terminal sem gastar tokens ou precisar de API key da Anthropic.
O acesso e feito via GitHub Copilot Pro+.

---

## Como funciona

A arquitetura tem 3 componentes que trabalham juntos:

1. **Claude Code** (extensao oficial da Anthropic no VS Code)
   - Inicia um proxy HTTP local (ClaudeLanguageModelServer) numa porta aleatoria
   - Usa a API `vscode.lm.selectChatModels()` para acessar modelos Claude via Copilot
   - Quando uma sessao de chat comeca, um hook SessionStart grava as credenciais
     do proxy em `~/.claude/sdk-proxy-credentials.json`

2. **openclaude-vscode** (extensao complementar)
   - Faz polling do arquivo `sdk-proxy-credentials.json` a cada 10 segundos
   - Injeta as variaveis `ANTHROPIC_BASE_URL` e `ANTHROPIC_API_KEY` nos terminais
     do VS Code via `environmentVariableCollection`
   - Fornece o Control Center (painel lateral) para gerenciar o OpenClaude

3. **openclaude** (CLI no terminal)
   - Le as variaveis de ambiente injetadas pela extensao
   - Conecta ao proxy local do Claude Code
   - As requisicoes sao traduzidas para chamadas da API de Language Model do VS Code
   - Resultado: uso dos modelos Claude sem consumo de tokens

Fluxo resumido:

    Claude Code ativa -> inicia proxy na porta X -> grava credenciais no disco
    openclaude-vscode detecta -> injeta env vars nos terminais
    openclaude CLI le env vars -> conecta na porta X -> funciona

---

## Pre-requisitos

Antes de comecar, voce precisa ter instalado:

- **Node.js** v20 ou superior — https://nodejs.org/
- **Git** — https://git-scm.com/
- **VS Code** — https://code.visualstudio.com/
- **GitHub Copilot Pro+** — assinatura ativa no GitHub
- **Extensao Claude Code** — instalar pelo marketplace do VS Code
  (publisher: Anthropic, id: anthropic.claude-code)
- **Extensao GitHub Copilot** — instalar pelo marketplace do VS Code
  (publisher: GitHub, id: github.copilot)

Para verificar se Node.js e Git estao instalados, abra o terminal:

    node --version
    git --version

---

## Passo 1 — Clonar o repositorio

    git clone https://github.com/iFael/openclaude.git
    cd openclaude

---

## Passo 2 — Instalar o CLI

O repositorio inclui um script que faz tudo automaticamente:

    bash setup.sh

O script executa:
1. Verifica se `node` e `npm` existem
2. Instala `bun` automaticamente se nao estiver no sistema
3. Roda `npm install` (dependencias)
4. Roda `bun run build` (compila o CLI)
5. Roda `npm install -g` (instala o binario `openclaude` globalmente)

Apos o script, verifique:

    openclaude --version

Deve mostrar algo como `0.1.9 (Open Claude)`.

---

## Passo 3 — Instalar a extensao openclaude-vscode

A extensao esta empacotada como VSIX dentro do repositorio.

### Opcao A — Via interface do VS Code

1. Abra o VS Code
2. Pressione `Ctrl+Shift+X` (painel de extensoes)
3. Clique nos `...` no topo do painel
4. Selecione **"Install from VSIX..."**
5. Navegue ate: `openclaude/vscode-extension/openclaude-vscode/openclaude-vscode-0.2.0.vsix`
6. Clique "Install"

### Opcao B — Via terminal

    code --install-extension vscode-extension/openclaude-vscode/openclaude-vscode-0.2.0.vsix

**Importante:** Apos instalar, feche o VS Code completamente (File > Exit) e abra novamente.

---

## Passo 4 — Configurar o Git Bash (somente Windows)

O Claude Code precisa saber onde esta o `bash.exe`. Se o caminho padrao nao existir no seu PC,
voce vera o erro:

    Claude Code was unable to find CLAUDE_CODE_GIT_BASH_PATH path "..."

Para corrigir:

1. Descubra o caminho correto:

       where bash

   Exemplo de saida: `C:\Program Files\Git\usr\bin\bash.exe`

2. Configure no VS Code:
   - Pressione `Ctrl+Shift+P`
   - Digite "Preferences: Open Settings (JSON)"
   - Adicione:

         "claude-code.gitBashPath": "C:\\Program Files\\Git\\usr\\bin\\bash.exe"

   (use o caminho que `where bash` retornou)

3. Tambem configure a variavel de ambiente permanentemente:

       setx CLAUDE_CODE_GIT_BASH_PATH "C:\Program Files\Git\usr\bin\bash.exe"

4. Feche o VS Code completamente e abra novamente.

---

## Passo 5 — Conceder permissao de Language Model

Na primeira vez que o Claude Code tenta acessar os modelos do Copilot, o VS Code mostra um
dialogo pedindo permissao. Voce PRECISA aceitar essa permissao.

Se o dialogo nao aparecer automaticamente:

1. Pressione `Ctrl+Shift+P`
2. Procure por "Manage Language Model Access" ou "Gerenciar Acesso ao Modelo de Linguagem"
3. Encontre a extensao Claude Code na lista
4. Permita o acesso

Se o comando nao existir, verifique se as extensoes Claude Code e GitHub Copilot estao ativas:

    code --list-extensions | grep -i "copilot\|claude\|anthropic"

Deve aparecer pelo menos:
- `github.copilot`
- `anthropic.claude-code`

---

## Passo 6 — Primeiro uso (fluxo obrigatorio)

Toda vez que abrir o VS Code, siga esta ordem:

1. **Abra o chat do Claude Code** no painel lateral do VS Code
2. **Envie qualquer mensagem** (pode ser "oi") — isso inicia o proxy e grava as credenciais
3. **Abra um NOVO terminal** no VS Code (`Ctrl+Shift+``)
4. **Rode** `openclaude`

Deve aparecer:

    Provider: VS Code Proxy (Copilot Pro+)
    Model: claude-sonnet-4-6
    Endpoint: http://127.0.0.1:XXXXX
    Ready — type /help to begin

**Por que esse fluxo e necessario?**
O proxy so inicia quando uma sessao de chat do Claude Code comeca. Sem o proxy rodando,
o arquivo `sdk-proxy-credentials.json` nao e criado, e o openclaude nao tem para onde
se conectar. A porta muda a cada sessao, mas a extensao cuida disso automaticamente via polling.

---

## Passo 7 — Verificacao

Para confirmar que tudo esta funcionando:

    echo $ANTHROPIC_BASE_URL

Deve mostrar algo como `http://127.0.0.1:53814`.

    curl $ANTHROPIC_BASE_URL

Deve responder `Hello from ClaudeLanguageModelServer`.

    openclaude --version

Deve mostrar a versao.

    openclaude

Deve mostrar o banner com "VS Code Proxy (Copilot Pro+)" e o chat interativo.

---

## Troubleshooting

### Erro: "Unable to connect to API (ECONNREFUSED)"

**Causa:** O proxy nao esta rodando na porta indicada.

**Solucao:**
1. Abra o chat do Claude Code e envie uma mensagem
2. Abra um NOVO terminal (nao reutilize o antigo)
3. Rode `openclaude` novamente

### Erro: "Claude Code was unable to find CLAUDE_CODE_GIT_BASH_PATH"

**Causa:** O caminho do `bash.exe` esta incorreto.

**Solucao:** Siga o Passo 4.

### Erro: "Auth conflict: Using ANTHROPIC_API_KEY instead of Anthropic Console key"

**Causa:** Existe um login antigo do Claude Code com API key da Anthropic.

**Solucao:**

    claude /logout

Isso remove a credencial antiga. O openclaude usa o proxy (nao precisa de login).

### Provider mostra "Anthropic" em vez de "VS Code Proxy (Copilot Pro+)"

**Causa:** A extensao openclaude-vscode nao esta injetando as variaveis de ambiente.

**Solucao:**
1. Verifique se a extensao esta instalada: `code --list-extensions | grep openclaude`
2. Verifique se o arquivo de credenciais existe: `cat ~/.claude/sdk-proxy-credentials.json`
3. Se o arquivo nao existir, abra o chat do Claude Code e envie uma mensagem
4. Abra um NOVO terminal e rode `openclaude`

### A extensao nao ativa / nao aparece

**Solucao:**
1. Pressione `Ctrl+Shift+P` e rode "Developer: Show Running Extensions"
2. Procure "OpenClaude" na lista
3. Se nao estiver la, rode "Developer: Open Extension Host Log" e procure erros com "openclaude"
4. Se necessario, reinstale o VSIX (Passo 3)

### O dialogo de permissao do Language Model nao aparece

**Solucao:**
1. Verifique se GitHub Copilot e Claude Code estao instalados e ativos
2. Tente: `Ctrl+Shift+P` > "Developer: Reset Environment Variable Collections"
3. Feche e abra o VS Code
4. Abra o chat do Claude Code novamente

---

## Estrutura de arquivos relevantes

    ~/.claude/sdk-proxy-credentials.json    # Credenciais do proxy (porta + apiKey)
    ~/.claude/config.json                   # Config geral do Claude Code (nao editar)

    openclaude/                             # Repositorio clonado
    ├── setup.sh                            # Script de instalacao
    ├── src/                                # Codigo fonte do CLI
    ├── dist/                               # CLI compilado
    └── vscode-extension/
        └── openclaude-vscode/
            ├── openclaude-vscode-0.2.0.vsix  # Extensao empacotada
            ├── src/                           # Codigo fonte da extensao
            │   ├── extension.ts               # Ativacao, polling, injecao de env vars
            │   ├── proxy.ts                   # Proxy HTTP Anthropic-compatible
            │   ├── security.ts                # Validacoes de seguranca
            │   ├── renderer.ts                # UI do Control Center
            │   ├── presentation.ts            # Formatacao de status
            │   └── state.ts                   # Deteccao de workspace/provider
            └── out/                           # Extensao compilada (JS)

---

## Atualizando

Para atualizar o OpenClaude no futuro:

    cd openclaude
    git pull origin main
    bash setup.sh

Se houver VSIX novo, reinstale:

    code --install-extension vscode-extension/openclaude-vscode/openclaude-vscode-X.Y.Z.vsix

---

## Resumo rapido

    git clone https://github.com/iFael/openclaude.git
    cd openclaude
    bash setup.sh
    # Instalar VSIX via VS Code (Ctrl+Shift+X > ... > Install from VSIX)
    # Fechar e abrir VS Code
    # Abrir chat do Claude Code e enviar mensagem
    # Abrir novo terminal
    openclaude
