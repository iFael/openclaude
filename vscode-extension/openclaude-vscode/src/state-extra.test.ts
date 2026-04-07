import { test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  chooseLaunchWorkspace,
  describeProviderState,
  findCommandPath,
  isPathInsideWorkspace,
  parseProfileFile,
  resolveCommandCheckPath,
} from './state';

// ---------------------------------------------------------------------------
// parseProfileFile — uncovered branches
// ---------------------------------------------------------------------------

test('parseProfileFile returns null when parsed JSON is an array', () => {
  assert.equal(parseProfileFile(JSON.stringify([1, 2, 3])), null);
});

test('parseProfileFile returns null when profile field is missing', () => {
  assert.equal(parseProfileFile(JSON.stringify({ env: { OPENAI_MODEL: 'gpt-4o' }, createdAt: null })), null);
});

test('parseProfileFile rejects a profile not in SAVED_PROFILES (lmstudio)', () => {
  assert.equal(
    parseProfileFile(
      JSON.stringify({
        profile: 'lmstudio',
        env: { OPENAI_BASE_URL: 'http://localhost:1234/v1' },
        createdAt: null,
      }),
    ),
    null,
  );
});

test('parseProfileFile returns valid profile and sanitizes env (removes empty strings)', () => {
  const result = parseProfileFile(
    JSON.stringify({
      profile: 'openai',
      env: { OPENAI_MODEL: 'gpt-4o', EMPTY_KEY: '', WHITESPACE_KEY: '   ' },
      createdAt: '2026-04-07T00:00:00.000Z',
    }),
  );
  assert.ok(result);
  assert.equal(result!.profile, 'openai');
  assert.deepEqual(result!.env, { OPENAI_MODEL: 'gpt-4o' });
  assert.equal(result!.createdAt, '2026-04-07T00:00:00.000Z');
});

test('parseProfileFile filters out non-string env values', () => {
  const result = parseProfileFile(
    JSON.stringify({
      profile: 'ollama',
      env: {
        OPENAI_MODEL: 'llama3.2',
        NUMERIC: 42,
        BOOLEAN: true,
        NULL_VAL: null,
        NESTED: { a: 1 },
      },
      createdAt: null,
    }),
  );
  assert.ok(result);
  assert.deepEqual(result!.env, { OPENAI_MODEL: 'llama3.2' });
  assert.equal(result!.createdAt, null);
});

// ---------------------------------------------------------------------------
// isPathInsideWorkspace — uncovered branches
// ---------------------------------------------------------------------------

test('isPathInsideWorkspace returns false for null file path', () => {
  assert.equal(isPathInsideWorkspace(null, 'C:\\Users\\test\\workspace'), false);
});

test('isPathInsideWorkspace returns false for null workspace path', () => {
  assert.equal(isPathInsideWorkspace('C:\\Users\\test\\workspace\\file.ts', null), false);
});

test('isPathInsideWorkspace returns false for file outside workspace', () => {
  assert.equal(isPathInsideWorkspace('C:\\Users\\other\\file.ts', 'C:\\Users\\test\\workspace'), false);
});

test('isPathInsideWorkspace returns true when file equals workspace root (relative is empty)', () => {
  const workspace = 'C:\\Users\\test\\workspace';
  assert.equal(isPathInsideWorkspace(workspace, workspace), true);
});

test('isPathInsideWorkspace returns true for file inside workspace', () => {
  assert.equal(isPathInsideWorkspace('C:\\Users\\test\\workspace\\src\\file.ts', 'C:\\Users\\test\\workspace'), true);
});

test('isPathInsideWorkspace handles Windows case-insensitive comparison', () => {
  if (process.platform !== 'win32') {
    return; // skip on non-Windows — branch is platform-specific
  }
  assert.equal(
    isPathInsideWorkspace('C:\\Users\\TestUser\\Workspace\\src\\file.ts', 'c:\\users\\testuser\\workspace'),
    true,
  );
});

// ---------------------------------------------------------------------------
// describeProviderState — uncovered env-based provider branches
// ---------------------------------------------------------------------------

test('describeProviderState detects Gemini from environment', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: { CLAUDE_CODE_USE_GEMINI: '1', GEMINI_MODEL: 'gemini-2.5-pro' },
      profile: null,
    }),
    { label: 'Gemini', detail: 'gemini-2.5-pro', source: 'env' },
  );
});

test('describeProviderState detects GitHub Models from environment', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: { CLAUDE_CODE_USE_GITHUB: 'true' },
      profile: null,
    }),
    { label: 'GitHub Models', detail: 'from environment', source: 'env' },
  );
});

test('describeProviderState detects Foundry from environment', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: { CLAUDE_CODE_USE_FOUNDRY: '1' },
      profile: null,
    }),
    { label: 'Foundry', detail: 'from environment', source: 'env' },
  );
});

test('describeProviderState detects OpenAI when hostname is api.openai.com (no model)', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: {
        CLAUDE_CODE_USE_OPENAI: '1',
        OPENAI_BASE_URL: 'https://api.openai.com/v1',
      },
      profile: null,
    }),
    { label: 'OpenAI', detail: 'https://api.openai.com/v1', source: 'env' },
  );
});

test('describeProviderState detects Codex via chatgpt.com base URL', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: {
        CLAUDE_CODE_USE_OPENAI: '1',
        OPENAI_BASE_URL: 'https://chatgpt.com/backend-api/codex/v1',
        OPENAI_MODEL: 'gpt-5.4',
      },
      profile: null,
    }),
    { label: 'Codex', detail: 'gpt-5.4', source: 'env' },
  );
});

test('describeProviderState detects Codex via alias model without base URL', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: {
        CLAUDE_CODE_USE_OPENAI: '1',
        OPENAI_MODEL: 'codexplan',
      },
      profile: null,
    }),
    { label: 'Codex', detail: 'codexplan', source: 'env' },
  );
});

test('describeProviderState falls back to ChatGPT Codex detail when model is absent', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: {
        CLAUDE_CODE_USE_OPENAI: '1',
        OPENAI_BASE_URL: 'https://chatgpt.com/backend-api/codex/v1',
      },
      profile: null,
    }),
    { label: 'Codex', detail: 'ChatGPT Codex', source: 'env' },
  );
});

// ---------------------------------------------------------------------------
// describeProviderState — uncovered saved-profile branches
// ---------------------------------------------------------------------------

test('describeProviderState handles gemini saved profile', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: {},
      profile: { profile: 'gemini', env: { GEMINI_MODEL: 'gemini-2.5-pro' }, createdAt: null },
    }),
    { label: 'Gemini', detail: 'gemini-2.5-pro', source: 'profile' },
  );
});

test('describeProviderState handles codex saved profile', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: {},
      profile: { profile: 'codex', env: { OPENAI_MODEL: 'gpt-5.4' }, createdAt: null },
    }),
    { label: 'Codex', detail: 'gpt-5.4', source: 'profile' },
  );
});

test('describeProviderState handles atomic-chat saved profile', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: {},
      profile: { profile: 'atomic-chat', env: {}, createdAt: null },
    }),
    { label: 'Atomic Chat', detail: 'saved profile', source: 'profile' },
  );
});

// ---------------------------------------------------------------------------
// getOpenAICompatibleLabel — tested via describeProviderState (not exported)
// ---------------------------------------------------------------------------

test('getOpenAICompatibleLabel detects DeepSeek from URL', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: {
        CLAUDE_CODE_USE_OPENAI: '1',
        OPENAI_BASE_URL: 'https://api.deepseek.com/v1',
        OPENAI_MODEL: 'deepseek-chat',
      },
      profile: null,
    }),
    { label: 'DeepSeek', detail: 'deepseek-chat', source: 'env' },
  );
});

test('getOpenAICompatibleLabel detects DeepSeek from model name', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: {
        CLAUDE_CODE_USE_OPENAI: '1',
        OPENAI_BASE_URL: 'https://proxy.example.com/v1',
        OPENAI_MODEL: 'deepseek-coder-v2',
      },
      profile: null,
    }),
    { label: 'DeepSeek', detail: 'deepseek-coder-v2', source: 'env' },
  );
});

test('getOpenAICompatibleLabel detects OpenRouter from URL', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: {
        CLAUDE_CODE_USE_OPENAI: '1',
        OPENAI_BASE_URL: 'https://openrouter.ai/api/v1',
        OPENAI_MODEL: 'anthropic/claude-3.5-sonnet',
      },
      profile: null,
    }),
    { label: 'OpenRouter', detail: 'anthropic/claude-3.5-sonnet', source: 'env' },
  );
});

test('getOpenAICompatibleLabel detects Together AI from URL', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: {
        CLAUDE_CODE_USE_OPENAI: '1',
        OPENAI_BASE_URL: 'https://api.together.xyz/v1',
        OPENAI_MODEL: 'meta-llama/Llama-3-70b',
      },
      profile: null,
    }),
    { label: 'Together AI', detail: 'meta-llama/Llama-3-70b', source: 'env' },
  );
});

test('getOpenAICompatibleLabel detects Groq from URL', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: {
        CLAUDE_CODE_USE_OPENAI: '1',
        OPENAI_BASE_URL: 'https://api.groq.com/openai/v1',
        OPENAI_MODEL: 'llama-3.1-70b-versatile',
      },
      profile: null,
    }),
    { label: 'Groq', detail: 'llama-3.1-70b-versatile', source: 'env' },
  );
});

test('getOpenAICompatibleLabel detects Mistral from URL', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: {
        CLAUDE_CODE_USE_OPENAI: '1',
        OPENAI_BASE_URL: 'https://api.mistral.ai/v1',
        OPENAI_MODEL: 'mistral-large-latest',
      },
      profile: null,
    }),
    { label: 'Mistral', detail: 'mistral-large-latest', source: 'env' },
  );
});

test('getOpenAICompatibleLabel detects Mistral from model name on generic host', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: {
        CLAUDE_CODE_USE_OPENAI: '1',
        OPENAI_BASE_URL: 'https://gateway.example.com/v1',
        OPENAI_MODEL: 'mistral-7b-instruct',
      },
      profile: null,
    }),
    { label: 'Mistral', detail: 'mistral-7b-instruct', source: 'env' },
  );
});

// ---------------------------------------------------------------------------
// chooseLaunchWorkspace — uncovered branches
// ---------------------------------------------------------------------------

test('chooseLaunchWorkspace returns none for empty workspacePaths array', () => {
  assert.deepEqual(chooseLaunchWorkspace({ workspacePaths: [] }), {
    workspacePath: null,
    source: 'none',
  });
});

test('chooseLaunchWorkspace returns none when workspacePaths contains only empty strings', () => {
  assert.deepEqual(chooseLaunchWorkspace({ workspacePaths: ['', '   '] }), {
    workspacePath: null,
    source: 'none',
  });
});

// ---------------------------------------------------------------------------
// resolveCommandCheckPath — uncovered branches
// ---------------------------------------------------------------------------

test('resolveCommandCheckPath returns null for null command', () => {
  assert.equal(resolveCommandCheckPath(null), null);
});

test('resolveCommandCheckPath returns null for empty string command', () => {
  assert.equal(resolveCommandCheckPath(''), null);
});

test('resolveCommandCheckPath returns absolute path as-is', () => {
  if (process.platform === 'win32') {
    assert.equal(resolveCommandCheckPath('C:\\absolute\\path'), 'C:\\absolute\\path');
  } else {
    assert.equal(resolveCommandCheckPath('/absolute/path'), '/absolute/path');
  }
});

// ---------------------------------------------------------------------------
// findCommandPath — uncovered branches
// ---------------------------------------------------------------------------

test('findCommandPath returns null for null command', () => {
  assert.equal(findCommandPath(null), null);
});

test('findCommandPath returns null for empty string command', () => {
  assert.equal(findCommandPath(''), null);
});

test('findCommandPath returns null for relative path without cwd', () => {
  assert.equal(findCommandPath('./relative/cmd'), null);
});

test('findCommandPath returns null for relative path with cwd when file does not exist', () => {
  const result = findCommandPath('./nonexistent-binary-xyz', {
    cwd: process.platform === 'win32' ? 'C:\\Windows' : '/tmp',
  });
  assert.equal(result, null);
});

test('findCommandPath returns null when PATH env var is empty', () => {
  assert.equal(findCommandPath('somecommand', { env: {} }), null);
});

test('findCommandPath returns null when command is not found in any PATH directory', () => {
  const pathDir = process.platform === 'win32' ? 'C:\\Windows\\System32' : '/usr/bin';
  assert.equal(
    findCommandPath('reallynonexistent123456xyz', {
      env: { PATH: pathDir },
      platform: process.platform,
    }),
    null,
  );
});

test('findCommandPath finds an executable on PATH (platform-specific)', () => {
  if (process.platform === 'win32') {
    const result = findCommandPath('cmd', {
      env: { PATH: 'C:\\Windows\\System32' },
      platform: 'win32',
    });
    assert.ok(result, 'should find cmd on Windows');
    assert.ok(result!.toLowerCase().includes('cmd'), 'found path should contain cmd');
  } else {
    const result = findCommandPath('sh', {
      env: { PATH: '/bin:/usr/bin' },
      platform: 'linux',
    });
    assert.ok(result, 'should find sh on unix');
    assert.ok(result!.includes('sh'), 'found path should contain sh');
  }
});

// ---------------------------------------------------------------------------
// describeProviderState — remaining uncovered branches
// ---------------------------------------------------------------------------

test('describeProviderState detects Bedrock from environment', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: { CLAUDE_CODE_USE_BEDROCK: '1' },
      profile: null,
    }),
    { label: 'Bedrock', detail: 'from environment', source: 'env' },
  );
});

test('describeProviderState detects Azure OpenAI from URL', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: {
        CLAUDE_CODE_USE_OPENAI: '1',
        OPENAI_BASE_URL: 'https://myendpoint.azure.com/openai/v1',
        OPENAI_MODEL: 'gpt-4-turbo',
      },
      profile: null,
    }),
    { label: 'Azure OpenAI', detail: 'gpt-4-turbo', source: 'env' },
  );
});

test('describeProviderState detects Local OpenAI-compatible for localhost on non-standard port', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: {
        CLAUDE_CODE_USE_OPENAI: '1',
        OPENAI_BASE_URL: 'http://localhost:5000/v1',
        OPENAI_MODEL: 'custom-model',
      },
      profile: null,
    }),
    { label: 'Local OpenAI-compatible', detail: 'custom-model', source: 'env' },
  );
});

test('describeProviderState returns OpenAI-compatible for unknown remote host', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: {
        CLAUDE_CODE_USE_OPENAI: '1',
        OPENAI_BASE_URL: 'https://custom-proxy.example.com/v1',
        OPENAI_MODEL: 'custom-model',
      },
      profile: null,
    }),
    { label: 'OpenAI-compatible', detail: 'custom-model', source: 'env' },
  );
});

test('describeProviderState falls back to OpenAI when no URL and no model are set', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: { CLAUDE_CODE_USE_OPENAI: '1' },
      profile: null,
    }),
    { label: 'OpenAI', detail: 'OpenAI-compatible runtime', source: 'env' },
  );
});

test('describeProviderState handles invalid URL gracefully via getHostname and isLocalBaseUrl catch blocks', () => {
  assert.deepEqual(
    describeProviderState({
      shimEnabled: false,
      env: {
        CLAUDE_CODE_USE_OPENAI: '1',
        OPENAI_BASE_URL: 'not-a-valid-url',
      },
      profile: null,
    }),
    { label: 'OpenAI-compatible', detail: 'not-a-valid-url', source: 'env' },
  );
});
