import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import * as vscode from 'vscode';
import { renderControlCenterHtml, renderErrorHtml } from './renderer';
import {
  chooseLaunchWorkspace,
  describeProviderState,
  findCommandPath,
  isPathInsideWorkspace,
  parseProfileFile,
  resolveCommandCheckPath,
} from './state';

const OPENCLAUDE_REPO_URL = 'https://github.com/Gitlawb/openclaude';
const OPENCLAUDE_SETUP_URL = 'https://github.com/Gitlawb/openclaude/blob/main/README.md#quick-start';
const PROFILE_FILE_NAME = '.openclaude-profile.json';

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

interface LaunchTargetOptions {
  activeFilePath?: string | null;
  workspacePath?: string | null;
  workspaceSourceLabel?: string;
  executable?: string;
}

interface LaunchTargets {
  projectAwareCwd: string | null;
  projectAwareCwdLabel: string;
  projectAwareSourceLabel: string;
  workspaceRootCwd: string | null;
  workspaceRootCwdLabel: string;
  launchActionsShareTarget: boolean;
  launchActionsShareTargetReason: string | null;
}

interface LaunchOptions {
  requireWorkspace?: boolean;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

async function isCommandAvailable(command: string, launchCwd: string | null): Promise<boolean> {
  return Boolean(findCommandPath(command, { cwd: launchCwd ?? undefined }));
}

function getExecutableFromCommand(command: string): string {
  const normalized = String(command || '').trim();
  if (!normalized) {
    return '';
  }

  const doubleQuotedMatch = normalized.match(/^"([^"]+)"/);
  if (doubleQuotedMatch) {
    return doubleQuotedMatch[1];
  }

  const singleQuotedMatch = normalized.match(/^'([^']+)'/);
  if (singleQuotedMatch) {
    return singleQuotedMatch[1];
  }

  return normalized.split(/\s+/)[0];
}

function getWorkspacePaths(): string[] {
  return (vscode.workspace.workspaceFolders || []).map((folder) => folder.uri.fsPath);
}

function getActiveWorkspacePath(): string | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.scheme !== 'file') {
    return null;
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
  return workspaceFolder ? workspaceFolder.uri.fsPath : null;
}

function getActiveFilePath(): string | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.scheme !== 'file') {
    return null;
  }

  return editor.document.uri.fsPath || null;
}

// ---------------------------------------------------------------------------
// Launch target resolution
// ---------------------------------------------------------------------------

function resolveLaunchTargets({
  activeFilePath,
  workspacePath,
  workspaceSourceLabel,
  executable,
}: LaunchTargetOptions = {}): LaunchTargets {
  const activeFileDirectory = isPathInsideWorkspace(activeFilePath ?? null, workspacePath ?? null)
    ? path.dirname(activeFilePath!)
    : null;
  const normalizedExecutable = String(executable || '').trim();
  const commandPath = normalizedExecutable ? resolveCommandCheckPath(normalizedExecutable, workspacePath) : null;
  const relativeCommandRequiresWorkspaceRoot = Boolean(
    workspacePath && commandPath && !path.isAbsolute(normalizedExecutable),
  );

  if (relativeCommandRequiresWorkspaceRoot) {
    return {
      projectAwareCwd: workspacePath!,
      projectAwareCwdLabel: workspacePath!,
      projectAwareSourceLabel: 'workspace root (required by relative launch command)',
      workspaceRootCwd: workspacePath!,
      workspaceRootCwdLabel: workspacePath!,
      launchActionsShareTarget: true,
      launchActionsShareTargetReason: 'relative-launch-command',
    };
  }

  if (activeFileDirectory) {
    return {
      projectAwareCwd: activeFileDirectory,
      projectAwareCwdLabel: activeFileDirectory,
      projectAwareSourceLabel: 'active file directory',
      workspaceRootCwd: workspacePath || null,
      workspaceRootCwdLabel: workspacePath || 'No workspace open',
      launchActionsShareTarget: false,
      launchActionsShareTargetReason: null,
    };
  }

  if (workspacePath) {
    return {
      projectAwareCwd: workspacePath,
      projectAwareCwdLabel: workspacePath,
      projectAwareSourceLabel: workspaceSourceLabel || 'workspace root',
      workspaceRootCwd: workspacePath,
      workspaceRootCwdLabel: workspacePath,
      launchActionsShareTarget: true,
      launchActionsShareTargetReason: null,
    };
  }

  return {
    projectAwareCwd: null,
    projectAwareCwdLabel: 'VS Code default terminal cwd',
    projectAwareSourceLabel: 'VS Code default terminal cwd',
    workspaceRootCwd: null,
    workspaceRootCwdLabel: 'No workspace open',
    launchActionsShareTarget: false,
    launchActionsShareTargetReason: null,
  };
}

// ---------------------------------------------------------------------------
// State collection
// ---------------------------------------------------------------------------

function resolveLaunchWorkspace() {
  return chooseLaunchWorkspace({
    activeWorkspacePath: getActiveWorkspacePath() ?? undefined,
    workspacePaths: getWorkspacePaths(),
  });
}

function getWorkspaceSourceLabel(source: string): string {
  switch (source) {
    case 'active-workspace':
      return 'active editor workspace';
    case 'first-workspace':
      return 'first workspace folder';
    default:
      return 'no workspace open';
  }
}

function getProviderSourceLabel(source: string): string {
  switch (source) {
    case 'profile':
      return 'saved profile';
    case 'env':
      return 'environment';
    case 'shim':
      return 'launch setting';
    default:
      return 'unknown';
  }
}

function readWorkspaceProfile(profilePath: string | null) {
  if (!profilePath || !fs.existsSync(profilePath)) {
    return {
      profile: null,
      statusLabel: 'Missing',
      statusHint: `${PROFILE_FILE_NAME} not found in the workspace root`,
      filePath: null,
    };
  }

  try {
    const raw = fs.readFileSync(profilePath, 'utf8');
    const profile = parseProfileFile(raw);
    if (!profile) {
      return {
        profile: null,
        statusLabel: 'Invalid',
        statusHint: `${profilePath} has invalid JSON or an unsupported profile`,
        filePath: profilePath,
      };
    }

    return {
      profile,
      statusLabel: 'Found',
      statusHint: profilePath,
      filePath: profilePath,
    };
  } catch (error: unknown) {
    return {
      profile: null,
      statusLabel: 'Unreadable',
      statusHint: `${profilePath} (${error instanceof Error ? error.message : 'read failed'})`,
      filePath: profilePath,
    };
  }
}

async function collectControlCenterState() {
  const configured = vscode.workspace.getConfiguration('openclaude');
  const launchCommand = configured.get<string>('launchCommand', 'openclaude');
  const terminalName = configured.get<string>('terminalName', 'OpenClaude');
  const shimEnabled = configured.get<boolean>('useOpenAIShim', false);
  const executable = getExecutableFromCommand(launchCommand);
  const launchWorkspace = resolveLaunchWorkspace();
  const workspaceFolder = launchWorkspace.workspacePath;
  const workspaceSourceLabel = getWorkspaceSourceLabel(launchWorkspace.source);
  const launchTargets = resolveLaunchTargets({
    activeFilePath: getActiveFilePath(),
    workspacePath: workspaceFolder,
    workspaceSourceLabel,
    executable,
  });
  const installed = await isCommandAvailable(executable, launchTargets.projectAwareCwd);
  const profilePath = workspaceFolder ? path.join(workspaceFolder, PROFILE_FILE_NAME) : null;

  const profileState = workspaceFolder
    ? readWorkspaceProfile(profilePath)
    : {
        profile: null,
        statusLabel: 'No workspace',
        statusHint: 'Open a workspace folder to detect a saved profile',
        filePath: null,
      };

  const providerState = describeProviderState({
    shimEnabled,
    env: process.env,
    profile: profileState.profile,
  });

  return {
    installed,
    executable,
    launchCommand,
    terminalName,
    shimEnabled,
    workspaceFolder,
    workspaceSourceLabel,
    launchCwd: launchTargets.projectAwareCwd,
    launchCwdLabel: launchTargets.projectAwareCwdLabel,
    launchCwdSourceLabel: launchTargets.projectAwareSourceLabel,
    workspaceRootCwd: launchTargets.workspaceRootCwd,
    workspaceRootCwdLabel: launchTargets.workspaceRootCwdLabel,
    launchActionsShareTarget: launchTargets.launchActionsShareTarget,
    launchActionsShareTargetReason: launchTargets.launchActionsShareTargetReason,
    canLaunchInWorkspaceRoot: Boolean(workspaceFolder),
    profileStatusLabel: profileState.statusLabel,
    profileStatusHint: profileState.statusHint,
    workspaceProfilePath: profileState.filePath,
    providerState,
    providerSourceLabel: getProviderSourceLabel(providerState.source),
  };
}

// ---------------------------------------------------------------------------
// Launch actions
// ---------------------------------------------------------------------------

async function launchOpenClaude(options: LaunchOptions = {}): Promise<void> {
  const { requireWorkspace = false } = options;
  const configured = vscode.workspace.getConfiguration('openclaude');
  const launchCommand = configured.get<string>('launchCommand', 'openclaude');
  const terminalName = configured.get<string>('terminalName', 'OpenClaude');
  const shimEnabled = configured.get<boolean>('useOpenAIShim', false);
  const executable = getExecutableFromCommand(launchCommand);
  const launchWorkspace = resolveLaunchWorkspace();

  if (requireWorkspace && !launchWorkspace.workspacePath) {
    await vscode.window.showWarningMessage('Open a workspace folder before using Launch in Workspace Root.');
    return;
  }

  const launchTargets = resolveLaunchTargets({
    activeFilePath: getActiveFilePath(),
    workspacePath: launchWorkspace.workspacePath,
    workspaceSourceLabel: getWorkspaceSourceLabel(launchWorkspace.source),
    executable,
  });
  const targetCwd = requireWorkspace ? launchTargets.workspaceRootCwd : launchTargets.projectAwareCwd;
  const installed = await isCommandAvailable(executable, targetCwd);

  if (!installed) {
    const action = await vscode.window.showErrorMessage(
      `OpenClaude command not found: ${executable}. Install it with: npm install -g @gitlawb/openclaude`,
      'Open Setup Guide',
      'Open Repository',
    );

    if (action === 'Open Setup Guide') {
      await vscode.env.openExternal(vscode.Uri.parse(OPENCLAUDE_SETUP_URL));
    } else if (action === 'Open Repository') {
      await vscode.env.openExternal(vscode.Uri.parse(OPENCLAUDE_REPO_URL));
    }

    return;
  }

  const env: Record<string, string> = {};
  if (shimEnabled) {
    env.CLAUDE_CODE_USE_OPENAI = '1';
  }

  const terminalOptions: vscode.TerminalOptions = {
    name: terminalName,
    env,
  };

  if (targetCwd) {
    terminalOptions.cwd = targetCwd;
  }

  const terminal = vscode.window.createTerminal(terminalOptions);
  terminal.show(true);
  terminal.sendText(launchCommand, true);
}

async function openWorkspaceProfile(): Promise<void> {
  const state = await collectControlCenterState();

  if (!state.workspaceProfilePath) {
    await vscode.window.showInformationMessage(`No ${PROFILE_FILE_NAME} file was found for the current workspace.`);
    return;
  }

  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(state.workspaceProfilePath));
  await vscode.window.showTextDocument(document, { preview: false });
}

// ---------------------------------------------------------------------------
// WebviewViewProvider
// ---------------------------------------------------------------------------

class OpenClaudeControlCenterProvider implements vscode.WebviewViewProvider {
  webviewView: vscode.WebviewView | null;

  constructor() {
    this.webviewView = null;
  }

  async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
    this.webviewView = webviewView;
    webviewView.webview.options = { enableScripts: true };

    webviewView.onDidDispose(() => {
      if (this.webviewView === webviewView) {
        this.webviewView = null;
      }
    });

    webviewView.webview.onDidReceiveMessage(async (message: { type?: string }) => {
      switch (message?.type) {
        case 'launch':
          await launchOpenClaude();
          break;
        case 'launchRoot':
          await launchOpenClaude({ requireWorkspace: true });
          break;
        case 'openProfile':
          await openWorkspaceProfile();
          break;
        case 'repo':
          await vscode.env.openExternal(vscode.Uri.parse(OPENCLAUDE_REPO_URL));
          break;
        case 'setup':
          await vscode.env.openExternal(vscode.Uri.parse(OPENCLAUDE_SETUP_URL));
          break;
        case 'commands':
          await vscode.commands.executeCommand('workbench.action.showCommands');
          break;
        case 'refresh':
        default:
          break;
      }

      await this.refresh();
    });

    await this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.webviewView) {
      return;
    }

    try {
      const status = await collectControlCenterState();
      this.webviewView.webview.html = this.getHtml(status);
    } catch (error: unknown) {
      this.webviewView.webview.html = renderErrorHtml(error);
    }
  }

  getHtml(status: Awaited<ReturnType<typeof collectControlCenterState>>): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    return renderControlCenterHtml(status, { nonce, platform: process.platform });
  }
}

// ---------------------------------------------------------------------------
// SDK Proxy Credential Sync
// ---------------------------------------------------------------------------
// Claude Code's internal HTTP proxy (ClaudeLanguageModelServer) does NOT
// consume Copilot premium requests. A SessionStart hook persists the proxy
// credentials to ~/.claude/sdk-proxy-credentials.json whenever a Claude
// Code chat session starts. This extension polls that file and injects the
// credentials into terminals via environmentVariableCollection so that
// `openclaude` works automatically.
// ---------------------------------------------------------------------------

const CREDENTIAL_POLL_INTERVAL_MS = 10000;
const PROXY_HEALTH_CHECK_TIMEOUT_MS = 2000;

let _lastBaseUrl = '';
let _lastApiKey = '';
let _envCollection: vscode.GlobalEnvironmentVariableCollection | null = null;

const _credPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'sdk-proxy-credentials.json');

/**
 * Read proxy credentials from the file written by the SessionStart hook.
 */
function readCredentialsFile(): { baseUrl: string; apiKey: string } | null {
  try {
    if (!fs.existsSync(_credPath)) return null;
    const raw = fs.readFileSync(_credPath, 'utf8');
    const creds = JSON.parse(raw);
    if (creds.baseUrl && creds.apiKey && String(creds.apiKey).startsWith('vscode-lm-')) {
      return { baseUrl: creds.baseUrl, apiKey: creds.apiKey };
    }
  } catch (err: unknown) {
    console.debug('[openclaude] readCredentialsFile failed:', err instanceof Error ? err.message : err);
  }
  return null;
}

/**
 * Verify that the proxy is alive by hitting GET /.
 */
function verifySdkProxy(baseUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const url = baseUrl.replace('://localhost', '://127.0.0.1');
    const req = http.get(url, { timeout: PROXY_HEALTH_CHECK_TIMEOUT_MS }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => resolve(data.includes('ClaudeLanguageModelServer')));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Poll for credentials: read the file, verify proxy liveness, and
 * inject into terminals via environmentVariableCollection.
 */
async function syncSdkProxyCredentials(): Promise<void> {
  const creds = readCredentialsFile();

  if (creds) {
    const baseUrl = creds.baseUrl.replace('://localhost', '://127.0.0.1');
    const apiKey = creds.apiKey;

    // Skip if nothing changed
    if (baseUrl === _lastBaseUrl && apiKey === _lastApiKey) return;

    const alive = await verifySdkProxy(creds.baseUrl);
    if (alive && _envCollection) {
      _envCollection.replace('ANTHROPIC_BASE_URL', baseUrl);
      _envCollection.replace('ANTHROPIC_API_KEY', apiKey);
      _envCollection.replace('CLAUDECODE', '1');
      _envCollection.replace('CLAUDE_CODE_ENTRYPOINT', 'sdk-ts');
      _lastBaseUrl = baseUrl;
      _lastApiKey = apiKey;
      return;
    }
  }

  // No valid proxy — clear stale env vars
  if (_lastBaseUrl && _envCollection) {
    _envCollection.delete('ANTHROPIC_BASE_URL');
    _envCollection.delete('ANTHROPIC_API_KEY');
    _envCollection.delete('CLAUDECODE');
    _envCollection.delete('CLAUDE_CODE_ENTRYPOINT');
    _lastBaseUrl = '';
    _lastApiKey = '';
  }
}

function activate(context: vscode.ExtensionContext): void {
  // --- SDK Proxy Credential Sync ---
  // Polls ~/.claude/sdk-proxy-credentials.json (written by SessionStart
  // hook) and injects credentials into terminals so `openclaude` connects
  // to the Claude Code proxy (0% premium consumption).

  const envCollection = context.environmentVariableCollection;
  envCollection.persistent = true;
  _envCollection = envCollection;

  syncSdkProxyCredentials();
  const pollInterval = setInterval(() => syncSdkProxyCredentials(), CREDENTIAL_POLL_INTERVAL_MS);

  // --- Control Center and commands ---
  const provider = new OpenClaudeControlCenterProvider();
  const refreshProvider = () => {
    void provider.refresh();
  };

  const startCommand = vscode.commands.registerCommand('openclaude.start', async () => {
    await launchOpenClaude();
  });

  const startInWorkspaceRootCommand = vscode.commands.registerCommand('openclaude.startInWorkspaceRoot', async () => {
    await launchOpenClaude({ requireWorkspace: true });
  });

  const openDocsCommand = vscode.commands.registerCommand('openclaude.openDocs', async () => {
    await vscode.env.openExternal(vscode.Uri.parse(OPENCLAUDE_REPO_URL));
  });

  const openSetupDocsCommand = vscode.commands.registerCommand('openclaude.openSetupDocs', async () => {
    await vscode.env.openExternal(vscode.Uri.parse(OPENCLAUDE_SETUP_URL));
  });

  const openWorkspaceProfileCommand = vscode.commands.registerCommand('openclaude.openWorkspaceProfile', async () => {
    await openWorkspaceProfile();
  });

  const openUiCommand = vscode.commands.registerCommand('openclaude.openControlCenter', async () => {
    await vscode.commands.executeCommand('workbench.view.extension.openclaude');
  });

  const providerDisposable = vscode.window.registerWebviewViewProvider('openclaude.controlCenter', provider);

  const profileWatcher = vscode.workspace.createFileSystemWatcher(`**/${PROFILE_FILE_NAME}`);

  context.subscriptions.push(
    { dispose: () => clearInterval(pollInterval) },
    startCommand,
    startInWorkspaceRootCommand,
    openDocsCommand,
    openSetupDocsCommand,
    openWorkspaceProfileCommand,
    openUiCommand,
    providerDisposable,
    profileWatcher,
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('openclaude')) {
        refreshProvider();
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(refreshProvider),
    vscode.window.onDidChangeActiveTextEditor(refreshProvider),
    profileWatcher.onDidCreate(refreshProvider),
    profileWatcher.onDidChange(refreshProvider),
    profileWatcher.onDidDelete(refreshProvider),
  );
}

function deactivate(): void {}

export {
  activate,
  deactivate,
  getExecutableFromCommand,
  getProviderSourceLabel,
  getWorkspaceSourceLabel,
  OpenClaudeControlCenterProvider,
  readWorkspaceProfile,
  renderControlCenterHtml,
  resolveLaunchTargets,
};
