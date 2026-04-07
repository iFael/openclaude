import { mock, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// Mock vscode with full stubs
mock.module('vscode', () => ({
  workspace: {
    workspaceFolders: [],
    getConfiguration: () => ({ get: (_k: any, fb: any) => fb }),
    getWorkspaceFolder: () => null,
    createFileSystemWatcher: () => ({
      onDidCreate: () => ({ dispose() {} }),
      onDidChange: () => ({ dispose() {} }),
      onDidDelete: () => ({ dispose() {} }),
    }),
  },
  window: {
    activeTextEditor: null,
    registerWebviewViewProvider: () => ({ dispose() {} }),
    showInformationMessage: async () => undefined,
    showErrorMessage: async () => undefined,
    showWarningMessage: async () => undefined,
    createTerminal: () => ({ show() {}, sendText() {} }),
    onDidChangeActiveTextEditor: () => ({ dispose() {} }),
  },
  env: { openExternal: async () => true },
  commands: { registerCommand: () => ({ dispose() {} }), executeCommand: async () => undefined },
  Uri: { parse: (v: any) => v, file: (v: any) => v },
  ViewColumn: { Active: 1 },
  lm: { selectChatModels: async () => [], onDidChangeChatModels: () => ({ dispose() {} }) },
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

const ext = await import(`./extension?ts=${Date.now()}`);
const {
  getExecutableFromCommand,
  getWorkspaceSourceLabel,
  getProviderSourceLabel,
  readWorkspaceProfile,
  resolveLaunchTargets,
} = ext;

// ---------------------------------------------------------------------------
// getExecutableFromCommand
// ---------------------------------------------------------------------------

test('getExecutableFromCommand extracts bare command', () => {
  assert.equal(getExecutableFromCommand('openclaude'), 'openclaude');
});

test('getExecutableFromCommand extracts first word from command with args', () => {
  assert.equal(getExecutableFromCommand('openclaude --project-aware'), 'openclaude');
});

test('getExecutableFromCommand extracts double-quoted path', () => {
  assert.equal(getExecutableFromCommand('"C:\\Program Files\\openclaude" --flag'), 'C:\\Program Files\\openclaude');
});

test('getExecutableFromCommand extracts single-quoted path', () => {
  assert.equal(getExecutableFromCommand("'/usr/local/bin/openclaude' --flag"), '/usr/local/bin/openclaude');
});

test('getExecutableFromCommand returns empty for null/empty', () => {
  assert.equal(getExecutableFromCommand(''), '');
  assert.equal(getExecutableFromCommand(null), '');
  assert.equal(getExecutableFromCommand(undefined), '');
});

// ---------------------------------------------------------------------------
// getWorkspaceSourceLabel
// ---------------------------------------------------------------------------

test('getWorkspaceSourceLabel active-workspace', () => {
  assert.equal(getWorkspaceSourceLabel('active-workspace'), 'active editor workspace');
});

test('getWorkspaceSourceLabel first-workspace', () => {
  assert.equal(getWorkspaceSourceLabel('first-workspace'), 'first workspace folder');
});

test('getWorkspaceSourceLabel default', () => {
  assert.equal(getWorkspaceSourceLabel('none'), 'no workspace open');
  assert.equal(getWorkspaceSourceLabel('unknown'), 'no workspace open');
});

// ---------------------------------------------------------------------------
// getProviderSourceLabel
// ---------------------------------------------------------------------------

test('getProviderSourceLabel profile', () => {
  assert.equal(getProviderSourceLabel('profile'), 'saved profile');
});

test('getProviderSourceLabel env', () => {
  assert.equal(getProviderSourceLabel('env'), 'environment');
});

test('getProviderSourceLabel shim', () => {
  assert.equal(getProviderSourceLabel('shim'), 'launch setting');
});

test('getProviderSourceLabel default', () => {
  assert.equal(getProviderSourceLabel('unknown'), 'unknown');
  assert.equal(getProviderSourceLabel('other'), 'unknown');
});

// ---------------------------------------------------------------------------
// readWorkspaceProfile
// ---------------------------------------------------------------------------

test('readWorkspaceProfile returns Missing for null path', () => {
  const result = readWorkspaceProfile(null);
  assert.equal(result.statusLabel, 'Missing');
  assert.equal(result.profile, null);
  assert.equal(result.filePath, null);
});

test('readWorkspaceProfile returns Missing for non-existent file', () => {
  const result = readWorkspaceProfile('/tmp/nonexistent/.openclaude-profile.json');
  assert.equal(result.statusLabel, 'Missing');
});

test('readWorkspaceProfile returns Invalid for bad JSON', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-test-'));
  try {
    const filePath = path.join(tmpDir, '.openclaude-profile.json');
    fs.writeFileSync(filePath, '{bad json}', 'utf8');
    const result = readWorkspaceProfile(filePath);
    assert.equal(result.statusLabel, 'Invalid');
    assert.equal(result.profile, null);
    assert.equal(result.filePath, filePath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('readWorkspaceProfile returns Found for valid profile', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-test-'));
  try {
    const filePath = path.join(tmpDir, '.openclaude-profile.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        profile: 'openai',
        env: { OPENAI_MODEL: 'gpt-4o' },
        createdAt: '2026-04-03T00:00:00.000Z',
      }),
      'utf8',
    );
    const result = readWorkspaceProfile(filePath);
    assert.equal(result.statusLabel, 'Found');
    assert.notEqual(result.profile, null);
    assert.equal(result.filePath, filePath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('readWorkspaceProfile returns Invalid for unsupported profile', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-test-'));
  try {
    const filePath = path.join(tmpDir, '.openclaude-profile.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        profile: 'lmstudio',
        env: {},
        createdAt: '2026-04-03T00:00:00.000Z',
      }),
      'utf8',
    );
    const result = readWorkspaceProfile(filePath);
    assert.equal(result.statusLabel, 'Invalid');
    assert.equal(result.profile, null);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// resolveLaunchTargets edge cases
// ---------------------------------------------------------------------------

test('resolveLaunchTargets with no workspace and no active file', () => {
  const result = resolveLaunchTargets({});
  assert.equal(result.projectAwareCwd, null);
  assert.equal(result.workspaceRootCwd, null);
  assert.equal(result.launchActionsShareTarget, false);
});

test('resolveLaunchTargets with workspace but no active file', () => {
  const result = resolveLaunchTargets({
    workspacePath: '/workspace/project',
    workspaceSourceLabel: 'first workspace folder',
  });
  assert.equal(result.projectAwareCwd, '/workspace/project');
  assert.equal(result.workspaceRootCwd, '/workspace/project');
  assert.equal(result.launchActionsShareTarget, true);
});
