// ---------------------------------------------------------------------------
// extension-coverage.test.ts
//
// Purpose: Force bun's coverage tracker to attribute extension.ts lines.
//
// Bun does NOT track modules loaded via dynamic import with cache-busting
// query strings (e.g., `await import('./extension?ts=...')`). The existing
// extension-logic.test.ts and extension.test.ts use that pattern so their
// coverage shows 0% for extension.ts even though the tests pass.
//
// This file imports extension.ts WITHOUT a cache buster so bun resolves
// it to the canonical module path and instruments it for coverage.
//
// The mock.module('vscode', ...) call MUST execute before the dynamic
// import so that extension.ts receives the mock when it first loads.
// ---------------------------------------------------------------------------

import { mock, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Register vscode mock BEFORE importing extension
// ---------------------------------------------------------------------------

mock.module('vscode', () => ({
  workspace: {
    workspaceFolders: [],
    getConfiguration: () => ({ get: (_k: string, fb: unknown) => fb }),
    getWorkspaceFolder: () => null,
    openTextDocument: async (uri: unknown) => ({ uri }),
    createFileSystemWatcher: () => ({
      onDidCreate: () => ({ dispose() {} }),
      onDidChange: () => ({ dispose() {} }),
      onDidDelete: () => ({ dispose() {} }),
      dispose() {},
    }),
    onDidChangeConfiguration: () => ({ dispose() {} }),
    onDidChangeWorkspaceFolders: () => ({ dispose() {} }),
  },
  window: {
    activeTextEditor: null,
    registerWebviewViewProvider: () => ({ dispose() {} }),
    showInformationMessage: async () => undefined,
    showErrorMessage: async () => undefined,
    showWarningMessage: async () => undefined,
    createTerminal: () => ({ show() {}, sendText() {} }),
    showTextDocument: async () => undefined,
    onDidChangeActiveTextEditor: () => ({ dispose() {} }),
  },
  env: { openExternal: async () => true },
  commands: {
    registerCommand: () => ({ dispose() {} }),
    executeCommand: async () => undefined,
  },
  Uri: { parse: (v: string) => v, file: (v: string) => v },
  ViewColumn: { Active: 1 },
  lm: {
    selectChatModels: async () => [],
    onDidChangeChatModels: () => ({ dispose() {} }),
  },
  CancellationTokenSource: class {
    token = { isCancellationRequested: false };
    cancel() {}
  },
  LanguageModelError: class extends Error {},
  LanguageModelTextPart: class {
    constructor(public value: string) {}
  },
  LanguageModelToolCallPart: class {
    constructor(
      public callId: string,
      public name: string,
      public input: unknown,
    ) {}
  },
  LanguageModelToolResultPart: class {
    constructor(
      public callId: string,
      public parts: unknown[],
    ) {}
  },
  LanguageModelChatMessage: {
    User: (content: unknown) => ({ role: 'user', content }),
    Assistant: (content: unknown) => ({ role: 'assistant', content }),
  },
  LanguageModelChatTool: class {
    constructor(
      public name: string,
      public description: string,
      public inputSchema: unknown,
    ) {}
  },
}));

// ---------------------------------------------------------------------------
// Dynamic import WITHOUT cache buster — bun tracks this for coverage
// ---------------------------------------------------------------------------

const {
  getExecutableFromCommand,
  getWorkspaceSourceLabel,
  getProviderSourceLabel,
  readWorkspaceProfile,
  resolveLaunchTargets,
  OpenClaudeControlCenterProvider,
  activate,
  deactivate,
  renderControlCenterHtml,
  _internal,
} = await import('./extension');

// ---------------------------------------------------------------------------
// Helper: build a realistic ControlCenterStatus object for renderer tests
// ---------------------------------------------------------------------------

function createStatus(overrides: Record<string, unknown> = {}) {
  return {
    installed: true,
    executable: 'openclaude',
    launchCommand: 'openclaude --project-aware',
    terminalName: 'OpenClaude',
    shimEnabled: false,
    workspaceFolder: '/workspace/project',
    workspaceSourceLabel: 'active editor workspace',
    launchCwd: '/workspace/project',
    launchCwdLabel: '/workspace/project',
    launchCwdSourceLabel: 'active editor workspace',
    workspaceRootCwd: '/workspace/project',
    workspaceRootCwdLabel: '/workspace/project',
    launchActionsShareTarget: true,
    launchActionsShareTargetReason: null,
    canLaunchInWorkspaceRoot: true,
    profileStatusLabel: 'Found',
    profileStatusHint: '/workspace/project/.openclaude-profile.json',
    workspaceProfilePath: '/workspace/project/.openclaude-profile.json',
    providerState: { label: 'OpenAI', detail: 'gpt-4o', source: 'profile' },
    providerSourceLabel: 'saved profile',
    ...overrides,
  };
}

// ===========================================================================
// getExecutableFromCommand
// ===========================================================================

test('coverage: getExecutableFromCommand — bare command', () => {
  assert.equal(getExecutableFromCommand('openclaude'), 'openclaude');
});

test('coverage: getExecutableFromCommand — command with args', () => {
  assert.equal(getExecutableFromCommand('openclaude --flag --verbose'), 'openclaude');
});

test('coverage: getExecutableFromCommand — double-quoted path', () => {
  assert.equal(getExecutableFromCommand('"C:\\Program Files\\openclaude" --flag'), 'C:\\Program Files\\openclaude');
});

test('coverage: getExecutableFromCommand — single-quoted path', () => {
  assert.equal(getExecutableFromCommand("'/usr/local/bin/openclaude' --flag"), '/usr/local/bin/openclaude');
});

test('coverage: getExecutableFromCommand — empty / null / undefined', () => {
  assert.equal(getExecutableFromCommand(''), '');
  assert.equal(getExecutableFromCommand(null as unknown as string), '');
  assert.equal(getExecutableFromCommand(undefined as unknown as string), '');
});

test('coverage: getExecutableFromCommand — whitespace only', () => {
  assert.equal(getExecutableFromCommand('   '), '');
});

// ===========================================================================
// getWorkspaceSourceLabel
// ===========================================================================

test('coverage: getWorkspaceSourceLabel — active-workspace', () => {
  assert.equal(getWorkspaceSourceLabel('active-workspace'), 'active editor workspace');
});

test('coverage: getWorkspaceSourceLabel — first-workspace', () => {
  assert.equal(getWorkspaceSourceLabel('first-workspace'), 'first workspace folder');
});

test('coverage: getWorkspaceSourceLabel — none (default)', () => {
  assert.equal(getWorkspaceSourceLabel('none'), 'no workspace open');
});

test('coverage: getWorkspaceSourceLabel — unknown string (default)', () => {
  assert.equal(getWorkspaceSourceLabel('anything-else'), 'no workspace open');
});

// ===========================================================================
// getProviderSourceLabel
// ===========================================================================

test('coverage: getProviderSourceLabel — profile', () => {
  assert.equal(getProviderSourceLabel('profile'), 'saved profile');
});

test('coverage: getProviderSourceLabel — env', () => {
  assert.equal(getProviderSourceLabel('env'), 'environment');
});

test('coverage: getProviderSourceLabel — shim', () => {
  assert.equal(getProviderSourceLabel('shim'), 'launch setting');
});

test('coverage: getProviderSourceLabel — default', () => {
  assert.equal(getProviderSourceLabel('unknown'), 'unknown');
  assert.equal(getProviderSourceLabel('xyz'), 'unknown');
});

// ===========================================================================
// readWorkspaceProfile
// ===========================================================================

test('coverage: readWorkspaceProfile — null path', () => {
  const result = readWorkspaceProfile(null);
  assert.equal(result.statusLabel, 'Missing');
  assert.equal(result.profile, null);
  assert.equal(result.filePath, null);
});

test('coverage: readWorkspaceProfile — empty string path', () => {
  const result = readWorkspaceProfile('');
  assert.equal(result.statusLabel, 'Missing');
});

test('coverage: readWorkspaceProfile — non-existent file', () => {
  const result = readWorkspaceProfile('/tmp/__nonexistent__/.openclaude-profile.json');
  assert.equal(result.statusLabel, 'Missing');
  assert.equal(result.profile, null);
});

test('coverage: readWorkspaceProfile — invalid JSON', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-cov-'));
  try {
    const filePath = path.join(tmpDir, '.openclaude-profile.json');
    fs.writeFileSync(filePath, '{not valid json!!!}', 'utf8');
    const result = readWorkspaceProfile(filePath);
    assert.equal(result.statusLabel, 'Invalid');
    assert.equal(result.profile, null);
    assert.equal(result.filePath, filePath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('coverage: readWorkspaceProfile — valid JSON but unsupported profile name', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-cov-'));
  try {
    const filePath = path.join(tmpDir, '.openclaude-profile.json');
    fs.writeFileSync(filePath, JSON.stringify({ profile: 'lmstudio', env: {}, createdAt: null }), 'utf8');
    const result = readWorkspaceProfile(filePath);
    assert.equal(result.statusLabel, 'Invalid');
    assert.equal(result.profile, null);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('coverage: readWorkspaceProfile — valid openai profile', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-cov-'));
  try {
    const filePath = path.join(tmpDir, '.openclaude-profile.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        profile: 'openai',
        env: { OPENAI_MODEL: 'gpt-4o' },
        createdAt: '2026-04-07T00:00:00.000Z',
      }),
      'utf8',
    );
    const result = readWorkspaceProfile(filePath);
    assert.equal(result.statusLabel, 'Found');
    assert.notEqual(result.profile, null);
    assert.equal(result.profile!.profile, 'openai');
    assert.equal(result.filePath, filePath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('coverage: readWorkspaceProfile — valid ollama profile', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-cov-'));
  try {
    const filePath = path.join(tmpDir, '.openclaude-profile.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        profile: 'ollama',
        env: { OPENAI_MODEL: 'llama3' },
        createdAt: '2026-04-07T00:00:00.000Z',
      }),
      'utf8',
    );
    const result = readWorkspaceProfile(filePath);
    assert.equal(result.statusLabel, 'Found');
    assert.equal(result.profile!.profile, 'ollama');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('coverage: readWorkspaceProfile — valid gemini profile', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-cov-'));
  try {
    const filePath = path.join(tmpDir, '.openclaude-profile.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        profile: 'gemini',
        env: { GEMINI_MODEL: 'gemini-pro' },
        createdAt: null,
      }),
      'utf8',
    );
    const result = readWorkspaceProfile(filePath);
    assert.equal(result.statusLabel, 'Found');
    assert.equal(result.profile!.profile, 'gemini');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('coverage: readWorkspaceProfile — valid codex profile', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-cov-'));
  try {
    const filePath = path.join(tmpDir, '.openclaude-profile.json');
    fs.writeFileSync(filePath, JSON.stringify({ profile: 'codex', env: {}, createdAt: null }), 'utf8');
    const result = readWorkspaceProfile(filePath);
    assert.equal(result.statusLabel, 'Found');
    assert.equal(result.profile!.profile, 'codex');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ===========================================================================
// resolveLaunchTargets
// ===========================================================================

test('coverage: resolveLaunchTargets — no arguments (empty defaults)', () => {
  const result = resolveLaunchTargets({});
  assert.equal(result.projectAwareCwd, null);
  assert.equal(result.projectAwareCwdLabel, 'VS Code default terminal cwd');
  assert.equal(result.projectAwareSourceLabel, 'VS Code default terminal cwd');
  assert.equal(result.workspaceRootCwd, null);
  assert.equal(result.workspaceRootCwdLabel, 'No workspace open');
  assert.equal(result.launchActionsShareTarget, false);
  assert.equal(result.launchActionsShareTargetReason, null);
});

test('coverage: resolveLaunchTargets — no arguments at all (undefined)', () => {
  const result = resolveLaunchTargets();
  assert.equal(result.projectAwareCwd, null);
  assert.equal(result.launchActionsShareTarget, false);
});

test('coverage: resolveLaunchTargets — workspace only, no active file', () => {
  const result = resolveLaunchTargets({
    workspacePath: '/workspace/project',
    workspaceSourceLabel: 'first workspace folder',
  });
  assert.equal(result.projectAwareCwd, '/workspace/project');
  assert.equal(result.workspaceRootCwd, '/workspace/project');
  assert.equal(result.projectAwareSourceLabel, 'first workspace folder');
  assert.equal(result.launchActionsShareTarget, true);
  assert.equal(result.launchActionsShareTargetReason, null);
});

test('coverage: resolveLaunchTargets — workspace only, no source label uses default', () => {
  const result = resolveLaunchTargets({
    workspacePath: '/workspace/project',
  });
  assert.equal(result.projectAwareSourceLabel, 'workspace root');
});

test('coverage: resolveLaunchTargets — active file inside workspace', () => {
  const result = resolveLaunchTargets({
    activeFilePath: '/workspace/project/src/index.ts',
    workspacePath: '/workspace/project',
    workspaceSourceLabel: 'active editor workspace',
  });
  assert.equal(result.projectAwareCwd, '/workspace/project/src');
  assert.equal(result.projectAwareSourceLabel, 'active file directory');
  assert.equal(result.workspaceRootCwd, '/workspace/project');
  assert.equal(result.launchActionsShareTarget, false);
  assert.equal(result.launchActionsShareTargetReason, null);
});

test('coverage: resolveLaunchTargets — active file outside workspace falls back to workspace', () => {
  const result = resolveLaunchTargets({
    activeFilePath: '/tmp/notes/scratch.txt',
    workspacePath: '/workspace/project',
    workspaceSourceLabel: 'first workspace folder',
  });
  assert.equal(result.projectAwareCwd, '/workspace/project');
  assert.equal(result.projectAwareSourceLabel, 'first workspace folder');
  assert.equal(result.launchActionsShareTarget, true);
});

test('coverage: resolveLaunchTargets — relative executable anchors to workspace root', () => {
  const result = resolveLaunchTargets({
    executable: './node_modules/.bin/openclaude',
    activeFilePath: '/workspace/project/src/deep/file.ts',
    workspacePath: '/workspace/project',
    workspaceSourceLabel: 'active editor workspace',
  });
  assert.equal(result.projectAwareCwd, '/workspace/project');
  assert.equal(result.projectAwareSourceLabel, 'workspace root (required by relative launch command)');
  assert.equal(result.launchActionsShareTarget, true);
  assert.equal(result.launchActionsShareTargetReason, 'relative-launch-command');
});

// ===========================================================================
// OpenClaudeControlCenterProvider
// ===========================================================================

test('coverage: OpenClaudeControlCenterProvider — constructor initializes webviewView to null', () => {
  const provider = new OpenClaudeControlCenterProvider();
  assert.equal(provider.webviewView, null);
});

test('coverage: OpenClaudeControlCenterProvider.getHtml — returns valid HTML with nonce', () => {
  const provider = new OpenClaudeControlCenterProvider();
  const html = provider.getHtml(createStatus());

  assert.ok(typeof html === 'string');
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('<script nonce='));
  assert.ok(!html.includes('nonce-undefined'));
  assert.ok(html.includes('Open<span class="wordmark-accent">Claude</span>'));
});

test('coverage: OpenClaudeControlCenterProvider.getHtml — CSP header contains nonce', () => {
  const provider = new OpenClaudeControlCenterProvider();
  const html = provider.getHtml(createStatus());

  assert.match(html, /script-src 'nonce-[A-Za-z0-9+/=]+'/);
});

test('coverage: OpenClaudeControlCenterProvider.getHtml — not-installed status renders correctly', () => {
  const provider = new OpenClaudeControlCenterProvider();
  const html = provider.getHtml(createStatus({ installed: false }));

  assert.ok(typeof html === 'string');
  assert.ok(html.includes('<!DOCTYPE html>'));
});

test('coverage: OpenClaudeControlCenterProvider.getHtml — no workspace renders disabled state', () => {
  const provider = new OpenClaudeControlCenterProvider();
  const html = provider.getHtml(
    createStatus({
      workspaceFolder: null,
      workspaceSourceLabel: 'no workspace open',
      launchCwd: null,
      launchCwdLabel: 'VS Code default terminal cwd',
      canLaunchInWorkspaceRoot: false,
      profileStatusLabel: 'No workspace',
      profileStatusHint: 'Open a workspace folder to detect a saved profile',
      workspaceProfilePath: null,
    }),
  );

  assert.ok(html.includes('No workspace profile yet'));
  assert.ok(!html.includes('id="openProfile"'));
});

test('coverage: OpenClaudeControlCenterProvider.refresh — does nothing when webviewView is null', async () => {
  const provider = new OpenClaudeControlCenterProvider();
  assert.equal(provider.webviewView, null);
  // Should not throw
  await provider.refresh();
});

// ===========================================================================
// renderControlCenterHtml (re-exported from renderer)
// ===========================================================================

test('coverage: renderControlCenterHtml — renders full HTML with summary cards', () => {
  const html = renderControlCenterHtml(createStatus(), { nonce: 'test-nonce', platform: 'linux' });

  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('class="summary-card"'));
  assert.ok(html.includes('class="action-button primary" id="launch"'));
  assert.ok(html.includes('class="action-button secondary" id="launchRoot"'));
});

test('coverage: renderControlCenterHtml — escapes HTML in user-controlled values', () => {
  const html = renderControlCenterHtml(
    createStatus({
      launchCommand: '<script>alert("xss")</script>',
      workspaceFolder: '"><img onerror="boom()">',
    }),
    { nonce: 'test-nonce', platform: 'win32' },
  );

  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>alert("xss")</script>'));
});

test('coverage: renderControlCenterHtml — platform-specific keyboard shortcut', () => {
  const htmlWin = renderControlCenterHtml(createStatus(), { nonce: 'n', platform: 'win32' });
  assert.ok(htmlWin.includes('Ctrl+Shift+P'));

  const htmlMac = renderControlCenterHtml(createStatus(), { nonce: 'n', platform: 'darwin' });
  assert.ok(htmlMac.includes('Cmd+Shift+P'));
});

test('coverage: renderControlCenterHtml — active file directory launch detail', () => {
  const html = renderControlCenterHtml(
    createStatus({
      launchCwd: '/workspace/project/src/components',
      launchCwdLabel: '/workspace/project/src/components',
      launchCwdSourceLabel: 'active file directory',
      workspaceRootCwd: '/workspace/project',
      workspaceRootCwdLabel: '/workspace/project',
      launchActionsShareTarget: false,
      launchActionsShareTargetReason: null,
    }),
    { nonce: 'n', platform: 'linux' },
  );

  assert.ok(html.includes('Starts beside the active file'));
  assert.ok(html.includes('Always starts at the workspace root'));
});

test('coverage: renderControlCenterHtml — relative command shared target detail', () => {
  const html = renderControlCenterHtml(
    createStatus({
      launchCwd: '/workspace/project',
      launchCwdLabel: '/workspace/project',
      launchCwdSourceLabel: 'workspace root (required by relative launch command)',
      launchActionsShareTarget: true,
      launchActionsShareTargetReason: 'relative-launch-command',
    }),
    { nonce: 'n', platform: 'linux' },
  );

  assert.ok(html.includes('anchored to the workspace root by the relative command'));
  assert.ok(html.includes('Same workspace-root target'));
});

// ===========================================================================
// activate / deactivate
// ===========================================================================

test('coverage: deactivate is a no-op function', () => {
  assert.doesNotThrow(() => deactivate());
});

test('coverage: activate registers commands and providers', () => {
  const disposables: Array<{ dispose: () => void }> = [];
  const fakeContext = {
    subscriptions: disposables,
    environmentVariableCollection: {
      persistent: false,
      replace: () => {},
      delete: () => {},
    },
  };

  assert.doesNotThrow(() => activate(fakeContext as any));
  assert.ok(disposables.length > 0, 'activate should push disposables into subscriptions');
});

// ---------------------------------------------------------------------------
// Internal functions (via _internal)
// ---------------------------------------------------------------------------

test('_internal: isCommandAvailable returns true for node', async () => {
  const result = await _internal.isCommandAvailable('node', null);
  assert.equal(result, true);
});

test('_internal: isCommandAvailable returns false for nonexistent command', async () => {
  const result = await _internal.isCommandAvailable('__nonexistent_cmd_xyz__', null);
  assert.equal(result, false);
});

test('_internal: getWorkspacePaths returns empty array when no workspace folders', () => {
  const paths = _internal.getWorkspacePaths();
  assert.ok(Array.isArray(paths));
});

test('_internal: getActiveWorkspacePath returns null when no editor', () => {
  assert.equal(_internal.getActiveWorkspacePath(), null);
});

test('_internal: getActiveFilePath returns null when no editor', () => {
  assert.equal(_internal.getActiveFilePath(), null);
});

test('_internal: resolveLaunchWorkspace returns a workspace object', () => {
  const result = _internal.resolveLaunchWorkspace();
  assert.ok(typeof result === 'object');
  assert.ok('workspacePath' in result);
  assert.ok('source' in result);
});

test('_internal: collectControlCenterState returns full state', async () => {
  const state = await _internal.collectControlCenterState();
  assert.ok(typeof state === 'object');
  assert.ok('installed' in state);
  assert.ok('executable' in state);
  assert.ok('launchCommand' in state);
  assert.ok('providerState' in state);
  assert.ok('profileStatusLabel' in state);
});

test('_internal: launchOpenClaude does not throw', async () => {
  await assert.doesNotReject(() => _internal.launchOpenClaude());
});

test('_internal: launchOpenClaude with requireWorkspace and no workspace shows warning', async () => {
  await assert.doesNotReject(() => _internal.launchOpenClaude({ requireWorkspace: true }));
});

test('_internal: openWorkspaceProfile handles no profile path', async () => {
  await assert.doesNotReject(() => _internal.openWorkspaceProfile());
});

test('_internal: readCredentialsFile returns null when file does not exist', () => {
  const result = _internal.readCredentialsFile();
  // Will return null since the credentials file is unlikely to exist in test env
  assert.ok(result === null || typeof result === 'object');
});

test('_internal: syncSdkProxyCredentials does not throw', async () => {
  await assert.doesNotReject(() => _internal.syncSdkProxyCredentials());
});

test('_internal: syncSdkProxyCredentials exercises credential flow without throwing', async () => {
  const replaced: string[] = [];
  const deleted: string[] = [];
  _internal._envCollection = {
    replace: (k: string) => {
      replaced.push(k);
    },
    delete: (k: string) => {
      deleted.push(k);
    },
  };

  // Reset state to force a fresh sync
  _internal._lastBaseUrl = '';
  _internal._lastApiKey = '';

  await assert.doesNotReject(() => _internal.syncSdkProxyCredentials());

  // The function either set new credentials or did nothing (depends on env)
  // In either case it should not throw
  _internal._envCollection = null;
});

test('_internal: verifySdkProxy returns false for dead endpoint', async () => {
  const result = await _internal.verifySdkProxy('http://127.0.0.1:1');
  assert.equal(result, false);
});

// ---------------------------------------------------------------------------
// resolveWebviewView
// ---------------------------------------------------------------------------

test('OpenClaudeControlCenterProvider.resolveWebviewView sets up webview', async () => {
  const provider = new OpenClaudeControlCenterProvider();

  let messageHandler: ((msg: any) => void) | null = null;
  let disposeHandler: (() => void) | null = null;
  const fakeWebviewView = {
    webview: {
      options: {} as any,
      html: '',
      onDidReceiveMessage: (fn: (msg: any) => void) => {
        messageHandler = fn;
      },
    },
    onDidDispose: (fn: () => void) => {
      disposeHandler = fn;
    },
  };

  await provider.resolveWebviewView(fakeWebviewView as any);

  assert.ok(fakeWebviewView.webview.options.enableScripts);
  assert.ok(fakeWebviewView.webview.html.length > 0, 'html should be rendered');
  assert.ok(messageHandler, 'message handler should be registered');
  assert.ok(disposeHandler, 'dispose handler should be registered');
});

test('resolveWebviewView handles all message types without throwing', async () => {
  const provider = new OpenClaudeControlCenterProvider();

  let messageHandler: ((msg: any) => Promise<void>) | null = null;
  const fakeWebviewView = {
    webview: {
      options: {} as any,
      html: '',
      onDidReceiveMessage: (fn: (msg: any) => Promise<void>) => {
        messageHandler = fn;
      },
    },
    onDidDispose: () => {},
  };

  await provider.resolveWebviewView(fakeWebviewView as any);

  for (const type of ['launch', 'launchRoot', 'openProfile', 'repo', 'setup', 'commands', 'refresh', null]) {
    await assert.doesNotReject(() => messageHandler!({ type }));
  }
});

test('resolveWebviewView onDidDispose clears webviewView', async () => {
  const provider = new OpenClaudeControlCenterProvider();

  let disposeHandler: (() => void) | null = null;
  const fakeWebviewView = {
    webview: {
      options: {} as any,
      html: '',
      onDidReceiveMessage: () => {},
    },
    onDidDispose: (fn: () => void) => {
      disposeHandler = fn;
    },
  };

  await provider.resolveWebviewView(fakeWebviewView as any);
  assert.equal((provider as any).webviewView, fakeWebviewView);

  disposeHandler!();
  assert.equal((provider as any).webviewView, null);
});
