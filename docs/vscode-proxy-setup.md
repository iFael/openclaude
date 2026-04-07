# OpenClaude — Guia Completo de Configuracao com VS Code Proxy (Copilot Pro+)

Este documento explica como configurar o OpenClaude do zero em qualquer PC,
usando o proxy do VS Code para acessar modelos Claude sem gastar tokens e sem
precisar de API key da Anthropic. O acesso e feito via GitHub Copilot Pro+.

---

## Como funciona

A arquitetura tem 4 componentes que trabalham juntos:

1. **Claude Code** (extensao oficial da Anthropic no VS Code)
   - Inicia um proxy HTTP local (ClaudeLanguageModelServer) numa porta aleatoria
   - Usa a API `vscode.lm.selectChatModels()` para acessar modelos Claude via Copilot
   - A porta muda toda vez que uma nova sessao comeca

2. **Hook SessionStart** (script customizado: `openclaude-proxy-seed.js`)
   - Roda automaticamente quando uma sessao do Claude Code inicia
   - Captura as variaveis ANTHROPIC_BASE_URL e ANTHROPIC_API_KEY do ambiente
   - Grava essas credenciais em `~/.claude/sdk-proxy-credentials.json`
   - SEM ESSE HOOK, o arquivo de credenciais NAO e criado e nada funciona

3. **openclaude-vscode** (extensao complementar)
   - Faz polling do arquivo `sdk-proxy-credentials.json` a cada 10 segundos
   - Injeta as variaveis `ANTHROPIC_BASE_URL` e `ANTHROPIC_API_KEY` nos terminais
     do VS Code via `environmentVariableCollection`
   - Fornece o Control Center (painel lateral) para gerenciar o OpenClaude

4. **openclaude** (CLI no terminal)
   - Le as variaveis de ambiente injetadas pela extensao
   - Conecta ao proxy local do Claude Code
   - Resultado: uso dos modelos Claude sem consumo de tokens

Fluxo resumido:

    Claude Code ativa
    -> inicia proxy na porta X
    -> hook SessionStart grava credenciais no disco
    -> openclaude-vscode detecta o arquivo
    -> injeta env vars nos terminais
    -> openclaude CLI le env vars
    -> conecta na porta X
    -> funciona

---

## Pre-requisitos

Antes de comecar, voce precisa ter instalado:

- **Node.js** v20 ou superior — https://nodejs.org/
- **Git** — https://git-scm.com/
- **VS Code** — https://code.visualstudio.com/
- **GitHub Copilot Pro+** — assinatura ativa no GitHub
- **Extensao Claude Code** — instalar pelo marketplace do VS Code
  (publisher: Anthropic, id: `anthropic.claude-code`)
- **Extensao GitHub Copilot** — instalar pelo marketplace do VS Code
  (publisher: GitHub, id: `github.copilot`)

Para verificar no terminal:

    node --version          # deve ser 20+
    git --version           # qualquer versao
    code --version          # qualquer versao

Para verificar extensoes do VS Code:

    code --list-extensions | grep -i "copilot\|claude\|anthropic"

Deve aparecer pelo menos:
- `github.copilot`
- `anthropic.claude-code`

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

Se `openclaude` nao for encontrado, feche e abra o terminal.

---

## Passo 3 — Instalar a extensao openclaude-vscode

A extensao esta empacotada como VSIX dentro do repositorio.
A versao correta e a **0.2.0** (versoes anteriores nao tem todos os modulos).

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

### Verificacao

Confirme que a extensao esta instalada:

    code --list-extensions | grep -i openclaude

Deve aparecer `devnull-bootloader.openclaude-vscode`.

---

## Passo 4 — Criar o hook SessionStart (CRITICO)

**Este e o passo mais importante.** Sem esse hook, o arquivo de credenciais
`sdk-proxy-credentials.json` NAO e criado automaticamente, e o openclaude
nao consegue se conectar ao proxy.

### 4.1 — Criar o diretorio de hooks

    mkdir -p ~/.claude/hooks

### 4.2 — Criar o arquivo do hook

Crie o arquivo `~/.claude/hooks/openclaude-proxy-seed.js` com este conteudo:

```javascript
// openclaude-proxy-seed.js
// SessionStart hook: persists VS Code SDK proxy credentials to disk so that
// `openclaude` in any terminal can auto-discover the proxy.
//
// Runs in the Claude Code SDK context where ANTHROPIC_BASE_URL and
// ANTHROPIC_API_KEY are set. Writes ~/.claude/sdk-proxy-credentials.json.

const fs = require('fs');
const path = require('path');
const os = require('os');

const baseUrl = process.env.ANTHROPIC_BASE_URL;
const apiKey = process.env.ANTHROPIC_API_KEY;

if (!baseUrl || !apiKey) {
  // Not in a VS Code proxy context — nothing to do.
  process.exit(0);
}

// Only seed when it looks like a VS Code local proxy with a vscode-lm token
try {
  const hostname = new URL(baseUrl).hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    process.exit(0);
  }
} catch {
  process.exit(0);
}

if (!String(apiKey).startsWith('vscode-lm-')) {
  process.exit(0);
}

const credPath = path.join(os.homedir(), '.claude', 'sdk-proxy-credentials.json');

try {
  fs.writeFileSync(credPath, JSON.stringify({
    baseUrl,
    apiKey,
    timestamp: new Date().toISOString(),
    source: 'claude-code-sdk',
  }));
} catch {
  // Best-effort — .claude dir might not exist yet
}
```

### 4.3 — Registrar o hook no settings.json do Claude Code

Edite o arquivo `~/.claude/settings.json`. Se o arquivo nao existir, crie-o.

**Se o arquivo NAO existir ou estiver vazio**, crie com este conteudo
(substitua SEU_USUARIO pelo nome de usuario do seu sistema):

No **Windows**:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"C:/Users/SEU_USUARIO/.claude/hooks/openclaude-proxy-seed.js\""
          }
        ]
      }
    ]
  }
}
```

No **macOS/Linux**:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.claude/hooks/openclaude-proxy-seed.js\""
          }
        ]
      }
    ]
  }
}
```

**Se o arquivo JA existir e JA tiver hooks**, adicione o bloco do
openclaude-proxy-seed ao array `SessionStart` existente. Exemplo:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "HOOKS_QUE_JA_EXISTIAM_AQUI"
          }
        ]
      },
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"C:/Users/SEU_USUARIO/.claude/hooks/openclaude-proxy-seed.js\""
          }
        ]
      }
    ]
  }
}
```

### 4.4 — Verificar que o hook foi criado

    cat ~/.claude/hooks/openclaude-proxy-seed.js
    cat ~/.claude/settings.json

Confirme que o arquivo do hook existe e que o settings.json referencia ele.

### Como o hook funciona

Quando o Claude Code inicia uma sessao no VS Code, ele define internamente
as variaveis `ANTHROPIC_BASE_URL` (ex: `http://localhost:53814`) e
`ANTHROPIC_API_KEY` (ex: `vscode-lm-a825cc5a-...`). Essas variaveis so
existem dentro do contexto da sessao.

O hook roda nesse momento, captura essas variaveis, e grava em disco no
arquivo `~/.claude/sdk-proxy-credentials.json`. A extensao openclaude-vscode
faz polling desse arquivo e injeta as credenciais nos terminais.

Sem esse hook, as credenciais nunca sao gravadas e o openclaude nao funciona.

---

## Passo 5 — Configurar o Git Bash (somente Windows)

O Claude Code precisa saber onde esta o `bash.exe`. Se o caminho padrao
nao existir no seu PC, voce vera o erro:

    Claude Code was unable to find CLAUDE_CODE_GIT_BASH_PATH path "..."

Para corrigir:

### 5.1 — Descobrir o caminho correto

    where bash

Exemplo de saida: `C:\Program Files\Git\usr\bin\bash.exe`

### 5.2 — Configurar no VS Code settings.json

Pressione `Ctrl+Shift+P` > "Preferences: Open Settings (JSON)" e adicione:

```json
"claude-code.gitBashPath": "C:\\Program Files\\Git\\usr\\bin\\bash.exe"
```

(use o caminho que `where bash` retornou, com barras duplas)

### 5.3 — Configurar variavel de ambiente permanente

    setx CLAUDE_CODE_GIT_BASH_PATH "C:\Program Files\Git\usr\bin\bash.exe"

### 5.4 — Reiniciar

Feche o VS Code completamente (File > Exit) e abra novamente.

---

## Passo 6 — Limpar credenciais antigas

Se voce ja usou o Claude Code antes com API key propria, Ollama, ou outro
provider, pode haver conflito. Limpe:

### 6.1 — Remover credenciais antigas do Claude Code

    claude /logout

### 6.2 — Deletar arquivo de credenciais antigo (se existir)

    rm ~/.claude/sdk-proxy-credentials.json 2>/dev/null

O hook vai recriar o arquivo com os dados corretos na proxima sessao.

### 6.3 — Limpar config.json do Claude Code (se necessario)

Se `~/.claude/config.json` tiver variaveis de ambiente como `ANTHROPIC_API_KEY=ollama`
ou chaves de API antigas, edite o arquivo e remova. O openclaude usa exclusivamente
as credenciais do proxy injetadas pela extensao — nada no config.json e necessario.

---

## Passo 7 — Conceder permissao de Language Model

Na primeira vez que o Claude Code tenta acessar os modelos do Copilot, o VS Code
mostra um dialogo pedindo permissao. Voce PRECISA aceitar essa permissao.

Se o dialogo nao aparecer automaticamente:

1. Pressione `Ctrl+Shift+P`
2. Procure por "Manage Language Model Access" ou "Gerenciar Acesso ao Modelo de Linguagem"
3. Encontre a extensao Claude Code na lista
4. Permita o acesso

---

## Passo 8 — Primeiro uso (fluxo obrigatorio)

Toda vez que abrir o VS Code, siga esta ordem:

1. **Abra o chat do Claude Code** no painel lateral do VS Code
2. **Envie qualquer mensagem** (pode ser "oi")
   - Isso inicia o proxy e dispara o hook SessionStart
   - O hook grava as credenciais em `~/.claude/sdk-proxy-credentials.json`
3. **Aguarde ~10 segundos** (tempo do polling da extensao)
4. **Abra um NOVO terminal** no VS Code (`Ctrl+Shift+``)
   - NAO reutilize um terminal antigo — as variaveis so sao injetadas em terminais novos
5. **Rode** `openclaude`

Deve aparecer:

    Provider: VS Code Proxy (Copilot Pro+)
    Model: claude-sonnet-4-6
    Endpoint: http://127.0.0.1:XXXXX
    Ready — type /help to begin

**Por que esse fluxo e necessario?**
O proxy so inicia quando uma sessao de chat do Claude Code comeca. Sem o proxy rodando,
o hook nao tem credenciais para capturar, o arquivo nao e criado, e o openclaude nao tem
para onde se conectar. A porta muda a cada sessao, mas o hook + polling cuida disso.

---

## Passo 9 — Verificacao completa

Execute cada comando no terminal do VS Code e confirme o resultado esperado:

### 9.1 — Verificar arquivo de credenciais

    cat ~/.claude/sdk-proxy-credentials.json

Deve mostrar algo como:

```json
{
  "baseUrl": "http://localhost:53814",
  "apiKey": "vscode-lm-a825cc5a-9b33-...",
  "timestamp": "2026-04-07T15:45:10.646Z",
  "source": "claude-code-sdk"
}
```

- `baseUrl` deve ter uma porta local (ex: 53814)
- `apiKey` DEVE comecar com `vscode-lm-`
- Se `apiKey` for "ollama" ou outra coisa, esta errado — volte ao Passo 6

### 9.2 — Verificar variaveis de ambiente

    echo $ANTHROPIC_BASE_URL

Deve mostrar algo como `http://127.0.0.1:53814`.

    echo $ANTHROPIC_API_KEY

Deve comecar com `vscode-lm-`.

Se ambos estiverem vazios, a extensao openclaude-vscode nao esta injetando.
Verifique se a extensao esta ativa (Passo 3).

### 9.3 — Verificar que o proxy esta vivo

    curl $ANTHROPIC_BASE_URL

Deve responder `Hello from ClaudeLanguageModelServer`.

Se der ECONNREFUSED, o proxy caiu. Volte ao Passo 8 (envie mensagem no chat).

### 9.4 — Testar o openclaude

    openclaude

Deve mostrar o banner com "VS Code Proxy (Copilot Pro+)" e o chat interativo.
Envie uma mensagem de teste e confirme que recebe resposta.

---

## Troubleshooting

### Erro: "Unable to connect to API (ECONNREFUSED)"

**Causa:** O proxy nao esta rodando na porta indicada.

**Solucao:**
1. Abra o chat do Claude Code e envie uma mensagem (ativa o proxy)
2. Aguarde ~10 segundos
3. Abra um NOVO terminal (nao reutilize o antigo)
4. Rode `openclaude` novamente

### Erro: "Claude Code was unable to find CLAUDE_CODE_GIT_BASH_PATH"

**Causa:** O caminho do `bash.exe` esta incorreto (somente Windows).

**Solucao:** Siga o Passo 5.

### Erro: "Auth conflict: Using ANTHROPIC_API_KEY instead of Anthropic Console key"

**Causa:** Existe um login antigo do Claude Code com API key da Anthropic.

**Solucao:** Rode `claude /logout` e siga o Passo 6.

### Provider mostra "Anthropic" em vez de "VS Code Proxy (Copilot Pro+)"

**Causa:** As variaveis de ambiente nao estao sendo injetadas.

**Solucao:**
1. Verifique se a extensao esta instalada: `code --list-extensions | grep openclaude`
2. Verifique se o arquivo de credenciais existe: `cat ~/.claude/sdk-proxy-credentials.json`
3. Se o arquivo nao existir, o hook nao esta funcionando — volte ao Passo 4
4. Se o arquivo existir mas as env vars estiverem vazias, abra um NOVO terminal
5. Se nada funcionar, rode no VS Code: `Ctrl+Shift+P` > "Developer: Show Running Extensions"
   e confirme que "OpenClaude" aparece na lista

### O arquivo sdk-proxy-credentials.json nao e criado

**Causa:** O hook SessionStart nao esta configurado.

**Solucao:**
1. Verifique se o arquivo do hook existe: `cat ~/.claude/hooks/openclaude-proxy-seed.js`
2. Verifique se esta registrado: `cat ~/.claude/settings.json` (deve ter SessionStart)
3. Se ambos existirem, o caminho do hook no settings.json pode estar errado
4. Volte ao Passo 4 e refaca a configuracao

### O dialogo de permissao do Language Model nao aparece

**Solucao:**
1. Verifique se GitHub Copilot e Claude Code estao instalados e ativos
2. Tente: `Ctrl+Shift+P` > "Developer: Reset Environment Variable Collections"
3. Feche e abra o VS Code
4. Abra o chat do Claude Code novamente

### A extensao nao ativa / nao aparece

**Solucao:**
1. `Ctrl+Shift+P` > "Developer: Show Running Extensions"
2. Procure "OpenClaude" na lista
3. Se nao estiver la, rode "Developer: Open Extension Host Log" e procure erros com "openclaude"
4. Se necessario, reinstale o VSIX (Passo 3)

---

## Estrutura de arquivos relevantes

    ~/.claude/
    ├── settings.json                       # Config do Claude Code (hooks ficam aqui)
    ├── sdk-proxy-credentials.json          # Credenciais do proxy (escrito pelo hook)
    ├── config.json                         # Config geral (nao editar)
    └── hooks/
        └── openclaude-proxy-seed.js        # Hook que grava credenciais

    openclaude/                             # Repositorio clonado
    ├── setup.sh                            # Script de instalacao do CLI
    ├── docs/
    │   └── vscode-proxy-setup.md           # Este documento
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

O hook e o settings.json NAO precisam ser reconfigurados — persistem em `~/.claude/`.

---

## Resumo rapido (checklist)

    [ ] 1. git clone + cd openclaude
    [ ] 2. bash setup.sh (instala CLI)
    [ ] 3. Instalar VSIX 0.2.0 no VS Code
    [ ] 4. Criar ~/.claude/hooks/openclaude-proxy-seed.js
    [ ] 5. Registrar hook no ~/.claude/settings.json
    [ ] 6. Configurar Git Bash path (Windows)
    [ ] 7. Limpar credenciais antigas (claude /logout)
    [ ] 8. Fechar e abrir VS Code
    [ ] 9. Abrir chat do Claude Code + enviar mensagem
    [ ] 10. Abrir NOVO terminal + rodar openclaude
    [ ] 11. Confirmar: Provider = "VS Code Proxy (Copilot Pro+)"
