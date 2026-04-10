# OpenClaude — Guia Completo de Configuracao com VS Code Proxy (Copilot Pro+)

Este documento explica como configurar o OpenClaude do zero em qualquer PC,
usando o proxy do VS Code para acessar modelos Claude sem gastar tokens e sem
precisar de API key da Anthropic. O acesso e feito via GitHub Copilot Pro+.

---

## Como funciona

A arquitetura tem 4 componentes que trabalham juntos:

1. **Claude Code** (extensao oficial da Anthropic no VS Code)
   - Quando iniciado dentro do VS Code com GitHub Copilot ativo, usa a API
     `vscode.lm.selectChatModels()` para acessar modelos Claude via Copilot
   - Inicia um proxy HTTP local numa porta aleatoria
   - Define `ANTHROPIC_BASE_URL` (ex: `http://localhost:58118`) e
     `ANTHROPIC_AUTH_TOKEN` (ex: `vscode-lm-cc680068-...`) no ambiente da sessao
   - **Importante:** O token `vscode-lm-*` fica em `ANTHROPIC_AUTH_TOKEN`,
     NAO em `ANTHROPIC_API_KEY` (que fica vazio)
   - A porta muda toda vez que uma nova sessao comeca

2. **Hook SessionStart** (script customizado: `openclaude-proxy-seed.js`)
   - Roda automaticamente quando uma sessao do Claude Code inicia
   - Captura `ANTHROPIC_BASE_URL` e o token de `ANTHROPIC_AUTH_TOKEN`
     (ou `ANTHROPIC_API_KEY`, para compatibilidade)
   - Grava essas credenciais em `~/.claude/sdk-proxy-credentials.json`
   - SEM ESSE HOOK, o arquivo de credenciais NAO e criado e nada funciona

3. **openclaude-vscode** (extensao complementar v0.2.0)
   - Faz polling do arquivo `sdk-proxy-credentials.json` a cada 10 segundos
   - Valida que `apiKey` comeca com `vscode-lm-` e que o proxy esta vivo
   - Injeta as variaveis nos terminais do VS Code via `environmentVariableCollection`:
     - `ANTHROPIC_BASE_URL` — URL do proxy local
     - `ANTHROPIC_API_KEY` — token `vscode-lm-*`
     - `ANTHROPIC_AUTH_TOKEN` — mesmo token (necessario para autenticacao Bearer)
   - Fornece o Control Center (painel lateral) para gerenciar o OpenClaude

4. **openclaude** (CLI no terminal)
   - Le as variaveis de ambiente injetadas pela extensao
   - Usa `ANTHROPIC_AUTH_TOKEN` para autenticar via `Authorization: Bearer`
     (o proxy NAO aceita `x-api-key`, apenas `Authorization: Bearer`)
   - Conecta ao proxy local do Claude Code
   - Resultado: uso dos modelos Claude sem consumo de tokens

Fluxo resumido:

    Claude Code ativa no VS Code
    -> inicia proxy na porta X
    -> define ANTHROPIC_AUTH_TOKEN=vscode-lm-...
    -> hook SessionStart grava credenciais no disco
    -> openclaude-vscode detecta o arquivo (polling 10s)
    -> verifica que o proxy esta vivo
    -> injeta env vars (ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY + ANTHROPIC_AUTH_TOKEN)
    -> usuario abre NOVO terminal
    -> openclaude CLI le env vars
    -> conecta na porta X com Authorization: Bearer
    -> funciona

---

## Pre-requisitos

Antes de comecar, voce precisa ter instalado:

- **Node.js** v20 ou superior — https://nodejs.org/
- **Git** — https://git-scm.com/
- **VS Code** — https://code.visualstudio.com/
- **GitHub Copilot Pro+** — assinatura ativa no GitHub
- **Extensao GitHub Copilot** — instalar pelo marketplace do VS Code
  (publisher: GitHub, id: `github.copilot` ou `github.copilot-chat`)
- **Extensao Claude Code** — instalar pelo marketplace do VS Code
  (publisher: Anthropic, id: `anthropic.claude-code`)

> **Nota sobre o Copilot:** O GitHub unificou `github.copilot` e
> `github.copilot-chat` numa unica extensao. Instalar qualquer uma das
> duas e suficiente. O importante e que a Language Model API esteja disponivel.

Para verificar no terminal:

    node --version          # deve ser 20+
    git --version           # qualquer versao
    code --version          # qualquer versao

Para verificar extensoes do VS Code (use o caminho completo no Windows se
`code --list-extensions` der erro de "bad option"):

    # macOS / Linux
    code --list-extensions | grep -iE "copilot|claude|anthropic"

    # Windows (se o comando acima falhar)
    "/c/Users/SEU_USUARIO/AppData/Local/Programs/Microsoft VS Code/bin/code" --list-extensions | grep -iE "copilot|claude|anthropic"

Deve aparecer pelo menos:
- `github.copilot-chat` (ou `github.copilot`)
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
A versao correta e a **0.2.0** (versoes anteriores nao tem suporte ao proxy SDK).

### Opcao A — Via interface do VS Code

1. Abra o VS Code
2. Pressione `Ctrl+Shift+X` (painel de extensoes)
3. Clique nos `...` no topo do painel
4. Selecione **"Install from VSIX..."**
5. Navegue ate: `openclaude/vscode-extension/openclaude-vscode/openclaude-vscode-0.2.0.vsix`
6. Clique "Install"

### Opcao B — Via terminal

    code --install-extension vscode-extension/openclaude-vscode/openclaude-vscode-0.2.0.vsix

> **Se `code --install-extension` falhar no Windows** com "bad option",
> use o caminho completo:
>
>     "/c/Users/SEU_USUARIO/AppData/Local/Programs/Microsoft VS Code/bin/code" --install-extension vscode-extension/openclaude-vscode/openclaude-vscode-0.2.0.vsix

### Opcao C — Instalacao manual (se VSIX falhar)

Se as opcoes anteriores nao funcionarem, extraia manualmente:

1. Copie o `.vsix` para `.zip` e extraia:

       cp vscode-extension/openclaude-vscode/openclaude-vscode-0.2.0.vsix /tmp/oc.zip
       unzip /tmp/oc.zip -d /tmp/oc-extracted

   > **Nota Windows:** O PowerShell `Expand-Archive` pode rejeitar arquivos `.vsix`
   > por nao reconhecer o formato. Por isso copie para `.zip` primeiro.
   > Use `unzip` (do Git Bash) ou 7-Zip se `Expand-Archive` falhar.

2. Copie o conteudo de `extension/` para a pasta de extensoes:

       cp -r /tmp/oc-extracted/extension ~/.vscode/extensions/devnull-bootloader.openclaude-vscode-0.2.0

   > **ATENCAO:** Dentro do VSIX extraido, os arquivos ficam numa subpasta chamada
   > `extension/`. Voce deve copiar o **conteudo** dessa subpasta, NAO o VSIX inteiro.
   > O `package.json` deve ficar na raiz do diretorio da extensao:
   > `~/.vscode/extensions/devnull-bootloader.openclaude-vscode-0.2.0/package.json`
   > Se o `package.json` estiver em `extension/package.json`, o VS Code nao encontra a extensao.

3. Se voce tinha versoes anteriores (v0.1.1, v0.1.2), delete as pastas antigas:

       rm -rf ~/.vscode/extensions/devnull-bootloader.openclaude-vscode-0.1.*

   > **ATENCAO:** Ao deletar pasta de extensao manualmente, o VS Code pode mostrar
   > erro na inicializacao ("Cannot find package.json for extension X"). Isso acontece
   > porque o registro interno (`~/.vscode/extensions/extensions.json`) ainda referencia
   > a extensao deletada. Para corrigir, edite `extensions.json` e remova a entrada
   > da versao antiga, ou simplesmente ignore — o VS Code vai se corrigir sozinho
   > ao reabrir.

**Importante:** Apos instalar, feche o VS Code completamente (File > Exit) e abra novamente.

### Correcao obrigatoria: injecao de ANTHROPIC_AUTH_TOKEN

A extensao v0.2.0 original injeta apenas `ANTHROPIC_API_KEY` nos terminais,
mas o proxy do Claude Code SDK so aceita autenticacao via `Authorization: Bearer`
(que requer `ANTHROPIC_AUTH_TOKEN`). E necessario aplicar essa correcao:

Edite o arquivo:

    ~/.vscode/extensions/devnull-bootloader.openclaude-vscode-0.2.0/out/extension.js

Procure a funcao `syncSdkProxyCredentials` (por volta da linha 468-470) e
adicione a linha `ANTHROPIC_AUTH_TOKEN`:

**ANTES:**

```javascript
_envCollection.replace('ANTHROPIC_BASE_URL', baseUrl);
_envCollection.replace('ANTHROPIC_API_KEY', apiKey);
_envCollection.replace('CLAUDECODE', '1');
```

**DEPOIS:**

```javascript
_envCollection.replace('ANTHROPIC_BASE_URL', baseUrl);
_envCollection.replace('ANTHROPIC_API_KEY', apiKey);
_envCollection.replace('ANTHROPIC_AUTH_TOKEN', apiKey);
_envCollection.replace('CLAUDECODE', '1');
```

Faca a mesma correcao na funcao `deactivate` (por volta da linha 531-536):

**ANTES:**

```javascript
_envCollection.delete('ANTHROPIC_BASE_URL');
_envCollection.delete('ANTHROPIC_API_KEY');
_envCollection.delete('CLAUDECODE');
```

**DEPOIS:**

```javascript
_envCollection.delete('ANTHROPIC_BASE_URL');
_envCollection.delete('ANTHROPIC_API_KEY');
_envCollection.delete('ANTHROPIC_AUTH_TOKEN');
_envCollection.delete('CLAUDECODE');
```

> **Por que essa correcao e necessaria?**
> O SDK Anthropic dentro do openclaude CLI usa dois metodos de autenticacao:
> - `ANTHROPIC_API_KEY` → envia como header `X-Api-Key`
> - `ANTHROPIC_AUTH_TOKEN` → envia como header `Authorization: Bearer`
>
> O proxy do Claude Code SDK **so aceita** `Authorization: Bearer`, rejeitando
> `X-Api-Key` com HTTP 401. Sem `ANTHROPIC_AUTH_TOKEN`, o openclaude envia
> o header errado e recebe 401 em todas as requests.

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
// Runs in the Claude Code SDK context where ANTHROPIC_BASE_URL is set and
// the vscode-lm-* token is in either ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN.
// Writes ~/.claude/sdk-proxy-credentials.json.

const fs = require('fs');
const path = require('path');
const os = require('os');

const baseUrl = process.env.ANTHROPIC_BASE_URL;
// The vscode-lm-* token may be in ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN
const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;

if (!baseUrl || !apiKey) {
  process.exit(0);
}

// Only seed when it looks like a VS Code local proxy
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

> **Detalhe tecnico:** O Claude Code SDK coloca o token `vscode-lm-*` em
> `ANTHROPIC_AUTH_TOKEN` (nao em `ANTHROPIC_API_KEY`). O hook tenta ambos
> para garantir compatibilidade com versoes futuras.

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
as variaveis `ANTHROPIC_BASE_URL` (ex: `http://localhost:58118`) e
`ANTHROPIC_AUTH_TOKEN` (ex: `vscode-lm-cc680068-...`). Essas variaveis so
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

Exemplo de saida: `C:\Program Files\Git\bin\bash.exe`

### 5.2 — Configurar no VS Code settings.json

Pressione `Ctrl+Shift+P` > "Preferences: Open Settings (JSON)" e adicione:

```json
"claude-code.gitBashPath": "C:\\Program Files\\Git\\bin\\bash.exe"
```

(use o caminho que `where bash` retornou, com barras duplas)

### 5.3 — Configurar variavel de ambiente permanente

    setx CLAUDE_CODE_GIT_BASH_PATH "C:\Program Files\Git\bin\bash.exe"

### 5.4 — Reiniciar

Feche o VS Code completamente (File > Exit) e abra novamente.

---

## Passo 6 — Limpar credenciais/configuracoes anteriores

Se voce ja usou o Claude Code antes com API key propria, Ollama, ou outro
provider, pode haver conflito. Limpe tudo:

### 6.1 — Remover credenciais antigas do Claude Code

    claude /logout

### 6.2 — Remover variaveis de ambiente do sistema (Windows)

Verifique se existem variaveis globais que vao interferir:

**PowerShell (como administrador):**

```powershell
# Verificar
[Environment]::GetEnvironmentVariable('ANTHROPIC_API_KEY', 'User')
[Environment]::GetEnvironmentVariable('ANTHROPIC_BASE_URL', 'User')

# Se retornarem valores (ex: "ollama", "http://localhost:11434/v1"), remova:
[Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', [NullString]::Value, 'User')
[Environment]::SetEnvironmentVariable('ANTHROPIC_BASE_URL', [NullString]::Value, 'User')
```

> **Importante:** Variaveis de ambiente permanentes com valores antigos (como
> `ANTHROPIC_API_KEY=ollama`) vao sobrescrever as credenciais injetadas pela
> extensao e causar erros 401. Remova-as.

### 6.3 — Deletar arquivo de credenciais antigo (se existir)

    rm ~/.claude/sdk-proxy-credentials.json 2>/dev/null

O hook vai recriar o arquivo com os dados corretos na proxima sessao.

### 6.4 — Limpar config.json do Claude Code (se necessario)

Se `~/.claude/config.json` tiver variaveis de ambiente como `ANTHROPIC_API_KEY=ollama`
ou chaves de API antigas, edite o arquivo e remova. O conteudo ideal e `{}` (vazio).
O openclaude usa exclusivamente as credenciais do proxy injetadas pela extensao.

### 6.5 — Remover hooks antigos de proxy (se existirem)

Se voce ja tentou configurar o proxy antes, pode ter hooks antigos que interferem:

    ls ~/.claude/hooks/

Mantenha apenas `openclaude-proxy-seed.js`. Remova outros hooks de proxy:

    rm -f ~/.claude/hooks/sdk-proxy-persist.js
    rm -f ~/.claude/hooks/test-proxy.js

Verifique tambem que o `~/.claude/settings.json` so referencia o
`openclaude-proxy-seed.js` no SessionStart (e nao hooks antigos).

### 6.6 — Remover profiles com porta hardcoded (se existirem)

Se o `~/.claude/settings.json` tiver um profile `cc-proxy` ou similar com
`ANTHROPIC_BASE_URL` apontando para uma porta fixa, remova-o. A porta do
proxy muda a cada sessao — profiles com porta fixa ficam stale imediatamente.

### 6.7 — Sobre o credentials.json

O arquivo `~/.claude/credentials.json` NAO e usado pelo openclaude e NAO
precisa existir. Se existir com dados antigos, pode ser ignorado ou deletado.

### 6.8 — NAO fazer login no Claude Code com API key

Ao abrir o Claude Code no VS Code, ele pode pedir login. **NAO faca login
com uma API key da Anthropic.** Se voce logar com API key, o Claude Code
usara autenticacao direta e NAO gerara o token `vscode-lm-*`.

O fluxo correto e: Claude Code detecta o Copilot Pro+ automaticamente e
usa a Language Model API. Se necessario, aceite a permissao de Language
Model Access quando o popup aparecer.

---

## Passo 7 — Conceder permissao de Language Model

Na primeira vez que o Claude Code tenta acessar os modelos do Copilot, o VS Code
mostra um dialogo pedindo permissao. Voce PRECISA aceitar essa permissao.

Se o dialogo nao aparecer automaticamente:

1. Pressione `Ctrl+Shift+P`
2. Procure por "Manage Language Model Access" ou "Gerenciar Acesso ao Modelo de Linguagem"
3. Encontre a extensao Claude Code na lista
4. Permita o acesso

> **Nota:** Se o dialogo nunca aparecer, verifique que o GitHub Copilot esta
> instalado, ativo, e que voce esta logado com uma conta GitHub que tem
> Copilot Pro+ ativo. Sem Copilot Pro+, a Language Model API nao esta disponivel.

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
para onde se conectar. A porta muda a cada sessao, mas o hook + polling cuida disso
automaticamente.

---

## Passo 9 — Verificacao completa

Execute cada comando num terminal NOVO do VS Code e confirme o resultado esperado:

### 9.1 — Verificar arquivo de credenciais

    cat ~/.claude/sdk-proxy-credentials.json

Deve mostrar algo como:

```json
{
  "baseUrl": "http://localhost:58118",
  "apiKey": "vscode-lm-cc680068-b095-492f-...",
  "timestamp": "2026-04-07T22:34:16.584Z",
  "source": "claude-code-sdk"
}
```

- `baseUrl` deve ter uma porta local (ex: 58118)
- `apiKey` DEVE comecar com `vscode-lm-`
- Se `apiKey` for "ollama", "no-key", ou outra coisa, esta errado — volte ao Passo 6

### 9.2 — Verificar variaveis de ambiente

    echo $ANTHROPIC_BASE_URL

Deve mostrar algo como `http://127.0.0.1:58118`.

    echo $ANTHROPIC_AUTH_TOKEN

Deve comecar com `vscode-lm-`.

    echo $ANTHROPIC_API_KEY

Tambem deve comecar com `vscode-lm-` (injetado pela extensao).

Se todos estiverem vazios, a extensao openclaude-vscode nao esta injetando.
Verifique se a extensao esta ativa (Passo 3) e abra um NOVO terminal.

### 9.3 — Verificar que o proxy esta vivo

    curl -s -o /dev/null -w "%{http_code}" -X POST \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $ANTHROPIC_AUTH_TOKEN" \
      -H "anthropic-version: 2023-06-01" \
      -d '{"model":"claude-sonnet-4-20250514","max_tokens":5,"messages":[{"role":"user","content":"hi"}]}' \
      "$ANTHROPIC_BASE_URL/v1/messages"

Deve retornar `200`.

Se retornar `401`, o token esta incorreto. Verifique o Passo 4.
Se retornar `000` ou ECONNREFUSED, o proxy nao esta rodando. Volte ao Passo 8.

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

### Erro: HTTP 401 (authentication_error / Invalid authentication)

**Causa:** O openclaude esta enviando o header `X-Api-Key` em vez
de `Authorization: Bearer`. Isso acontece quando `ANTHROPIC_AUTH_TOKEN`
nao esta definido e o SDK usa `ANTHROPIC_API_KEY` com o header errado.

**Solucao:**
1. Verifique se a correcao do Passo 3 foi aplicada (injecao de `ANTHROPIC_AUTH_TOKEN`)
2. Verifique: `echo $ANTHROPIC_AUTH_TOKEN` — deve comecar com `vscode-lm-`
3. Se estiver vazio, feche o terminal e abra um novo
4. Se continuar vazio, a extensao nao detectou o arquivo. Verifique o Passo 4

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

**Causa:** O hook SessionStart nao esta configurado ou nao encontra o token.

**Solucao:**
1. Verifique se o arquivo do hook existe: `cat ~/.claude/hooks/openclaude-proxy-seed.js`
2. Verifique se esta registrado: `cat ~/.claude/settings.json` (deve ter SessionStart)
3. Verifique que o hook captura `ANTHROPIC_AUTH_TOKEN` (nao so `ANTHROPIC_API_KEY`)
4. Se o hook existir mas o arquivo nao for criado, teste manualmente:
   `ANTHROPIC_BASE_URL=http://localhost:9999 ANTHROPIC_AUTH_TOKEN=vscode-lm-test node ~/.claude/hooks/openclaude-proxy-seed.js`
   e depois `cat ~/.claude/sdk-proxy-credentials.json`
5. Se ambos existirem, o caminho do hook no settings.json pode estar errado
6. Volte ao Passo 4 e refaca a configuracao

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

### ANTHROPIC_API_KEY ou ANTHROPIC_AUTH_TOKEN esta vazio no terminal

**Causa:** A extensao nao detectou credenciais validas ou o terminal foi
aberto antes da injecao.

**Solucao:**
1. Confirme que `~/.claude/sdk-proxy-credentials.json` existe e tem `apiKey`
   comecando com `vscode-lm-`
2. Aguarde 10 segundos (polling interval)
3. Abra um NOVO terminal
4. Se continuar vazio, verifique se ha variaveis de ambiente do sistema
   interferindo (Passo 6.2)

### Versoes antigas da extensao (v0.1.1, v0.1.2)

**Causa:** Versoes anteriores a v0.2.0 nao tem o modulo de polling de
credenciais. v0.1.1 era apenas launcher/theme. v0.1.2 tinha um proxy
proprio que iniciava `vscode.lm.selectChatModels()` direto — nao
funciona com o fluxo de hook.

**Solucao:**
1. Remova versoes antigas: `rm -rf ~/.vscode/extensions/devnull-bootloader.openclaude-vscode-0.1.*`
2. Instale apenas a v0.2.0 (Passo 3)
3. Se o VS Code mostrar erro sobre versao antiga, edite `~/.vscode/extensions/extensions.json`
   e remova a entrada da versao deletada

### Profile cc-proxy com porta hardcoded no settings.json

**Causa:** Se voce criou um profile no `~/.claude/settings.json` com
`ANTHROPIC_BASE_URL` apontando para uma porta fixa (ex: `http://127.0.0.1:9223`),
essa porta vai ficar stale porque o proxy muda de porta a cada sessao.

**Solucao:** NAO use profiles com porta hardcoded. Remova qualquer profile
`cc-proxy` ou similar do `~/.claude/settings.json`. O fluxo correto e via
hook + polling — a porta e atualizada automaticamente a cada sessao.

```json
// REMOVA ISSO do settings.json:
"profiles": {
  "cc-proxy": {
    "env": {
      "ANTHROPIC_AUTH_TOKEN": "",
      "ANTHROPIC_BASE_URL": "http://127.0.0.1:9223"
    }
  }
}
```

### Hooks antigos interferindo

**Causa:** Se voce tiver hooks antigos como `sdk-proxy-persist.js`,
`test-proxy.js`, ou outras versoes do hook de proxy no `~/.claude/hooks/`,
eles podem interferir ou sobrescrever o `sdk-proxy-credentials.json`.

**Solucao:**
1. Liste todos os hooks: `ls ~/.claude/hooks/`
2. Mantenha APENAS `openclaude-proxy-seed.js` (e outros hooks nao relacionados)
3. Remova hooks antigos de proxy: `rm ~/.claude/hooks/sdk-proxy-persist.js ~/.claude/hooks/test-proxy.js`
4. Verifique `~/.claude/settings.json` — so o `openclaude-proxy-seed.js` deve estar no SessionStart

### VS Code nao reconhece a extensao apos instalacao manual

**Causa:** O VS Code mantem um registro interno de extensoes em
`~/.vscode/extensions/extensions.json`. Se a extensao foi instalada
manualmente (copiando pasta), ela pode nao aparecer no registro.

**Solucao:**
1. Feche o VS Code
2. Abra `~/.vscode/extensions/extensions.json`
3. Se a entrada `devnull-bootloader.openclaude-vscode` nao existir, o VS Code
   normalmente detecta a pasta na proxima abertura. Se nao detectar, tente
   reinstalar via VSIX (Opcao A ou B do Passo 3)
4. Se houver entradas duplicadas ou para versoes que nao existem mais, remova-as

### O comando `code --install-extension` falha com "bad option" (Windows)

**Causa:** No Windows, executar `code` diretamente em certas shells (Git Bash,
MSYS2) pode causar problemas de parsing de argumentos, especialmente com o
`--install-extension` flag.

**Solucao:** Use o caminho completo para o executavel `code` do VS Code:

    "/c/Users/SEU_USUARIO/AppData/Local/Programs/Microsoft VS Code/bin/code" --install-extension <extensao>

Esse caminho aponta para o wrapper de CLI do VS Code que faz o parsing
correto dos argumentos.

### O `github.copilot` nao aparece nas extensoes (so `github.copilot-chat`)

**Causa:** O GitHub unificou as extensoes Copilot. Tentar instalar
`github.copilot` agora automaticamente instala `github.copilot-chat`.
Isso e normal e esperado — a Language Model API esta dentro do `copilot-chat`.

**Solucao:** Nenhuma acao necessaria. Se `github.copilot-chat` esta instalado,
a Language Model API ja esta disponivel.

---

## Detalhes tecnicos: autenticacao do proxy

O proxy HTTP do Claude Code SDK aceita **somente** autenticacao via
`Authorization: Bearer <token>`:

```
# ACEITO (200 OK):
Authorization: Bearer vscode-lm-cc680068-b095-...

# REJEITADO (401 Unauthorized):
X-Api-Key: vscode-lm-cc680068-b095-...
```

O SDK Anthropic dentro do openclaude CLI decide qual header usar:
- Se `ANTHROPIC_API_KEY` esta definido → usa `X-Api-Key` (REJEITADO pelo proxy)
- Se `ANTHROPIC_AUTH_TOKEN` esta definido → usa `Authorization: Bearer` (ACEITO)
- Se ambos estao definidos → envia ambos (ACEITO, pois Bearer tem precedencia)

Por isso a extensao precisa injetar `ANTHROPIC_AUTH_TOKEN` alem de
`ANTHROPIC_API_KEY`. Sem isso, o header errado e enviado.

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

> **Lembre:** Apos reinstalar o VSIX, aplique novamente a correcao do
> `ANTHROPIC_AUTH_TOKEN` no `out/extension.js` (Passo 3), a menos que a
> versao nova ja inclua a correcao.

O hook e o settings.json NAO precisam ser reconfigurados — persistem em `~/.claude/`.

---

## Resumo rapido (checklist)

    [ ] 1. git clone + cd openclaude
    [ ] 2. bash setup.sh (instala CLI)
    [ ] 3. Instalar VSIX 0.2.0 no VS Code (Opcao A, B ou C)
    [ ] 4. Aplicar correcao ANTHROPIC_AUTH_TOKEN no out/extension.js
    [ ] 5. Criar ~/.claude/hooks/openclaude-proxy-seed.js (captura AUTH_TOKEN)
    [ ] 6. Registrar hook no ~/.claude/settings.json (SessionStart)
    [ ] 7. Configurar Git Bash path (Windows: setx + VS Code settings)
    [ ] 8. Limpar credenciais/env vars antigas (claude /logout + removeenv)
    [ ] 9. Remover hooks antigos de proxy (sdk-proxy-persist.js, etc.)
    [ ] 10. Remover profiles com porta hardcoded (cc-proxy, etc.)
    [ ] 11. NAO fazer login no Claude Code com API key
    [ ] 12. Fechar e abrir VS Code
    [ ] 13. Aceitar permissao de Language Model (se popup aparecer)
    [ ] 14. Abrir chat do Claude Code + enviar mensagem
    [ ] 15. Aguardar 10s + abrir NOVO terminal
    [ ] 16. Verificar: echo $ANTHROPIC_AUTH_TOKEN (deve ser vscode-lm-*)
    [ ] 17. Rodar openclaude
    [ ] 18. Confirmar: Provider = "VS Code Proxy (Copilot Pro+)"

---

## Erros comuns e causas raiz (resumo)

| Sintoma | Causa raiz | Solucao |
| --- | --- | --- |
| HTTP 401 no proxy | Usando `X-Api-Key` em vez de `Authorization: Bearer` | Aplicar patch ANTHROPIC_AUTH_TOKEN (Passo 3) |
| `ANTHROPIC_API_KEY` vazio | Token esta em `ANTHROPIC_AUTH_TOKEN`, nao em `API_KEY` | Hook captura de AUTH_TOKEN (Passo 4) |
| `apiKey: "ollama"` no credentials | Env var permanente do sistema contamina | Remover env vars (Passo 6.2) |
| `apiKey: "no-key"` no credentials | Hook antigo sem validacao `vscode-lm-` | Atualizar hook (Passo 4) |
| ECONNREFUSED | Proxy nao esta rodando (porta mudou) | Reenviar mensagem no Claude Code (Passo 8) |
| Extensao nao ativa | VSIX extraido errado (package.json na subpasta) | Reinstalar com Opcao C (Passo 3) |
| `code --install-extension` "bad option" | Shell do Windows nao faz parse correto | Usar caminho completo do `bin/code` |
| `github.copilot` nao instala | Foi unificado no `github.copilot-chat` | Normal — nenhuma acao necessaria |
| Porta hardcoded nao funciona | Porta muda a cada sessao | Remover profile cc-proxy (Passo 6.6) |
