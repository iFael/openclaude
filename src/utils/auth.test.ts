import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { getAuthTokenSource, getAnthropicApiKeyWithSource, isVsCodeProxy } from './auth.js'

const RESET_KEYS = [
  'ANTHROPIC_BASE_URL',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDECODE',
  'ANTHROPIC_API_KEY',
] as const

const originalEnv = { ...process.env }

beforeEach(() => {
  for (const key of RESET_KEYS) {
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of RESET_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
})

describe('isVsCodeProxy', () => {
  test('returns true when all three conditions are met', () => {
    process.env.ANTHROPIC_BASE_URL = 'http://localhost:57760'
    process.env.CLAUDE_CODE_ENTRYPOINT = 'sdk-ts'
    process.env.CLAUDECODE = '1'
    expect(isVsCodeProxy()).toBe(true)
  })

  test('returns false when ANTHROPIC_BASE_URL is not set', () => {
    process.env.CLAUDE_CODE_ENTRYPOINT = 'sdk-ts'
    process.env.CLAUDECODE = '1'
    expect(isVsCodeProxy()).toBe(false)
  })

  test('returns false when ANTHROPIC_BASE_URL is not localhost', () => {
    process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com'
    process.env.CLAUDE_CODE_ENTRYPOINT = 'sdk-ts'
    process.env.CLAUDECODE = '1'
    expect(isVsCodeProxy()).toBe(false)
  })

  test('returns false when CLAUDECODE is not set', () => {
    process.env.ANTHROPIC_BASE_URL = 'http://localhost:57760'
    process.env.CLAUDE_CODE_ENTRYPOINT = 'sdk-ts'
    expect(isVsCodeProxy()).toBe(false)
  })

  test('returns false when CLAUDE_CODE_ENTRYPOINT is not sdk-ts', () => {
    process.env.ANTHROPIC_BASE_URL = 'http://localhost:57760'
    process.env.CLAUDE_CODE_ENTRYPOINT = 'cli'
    process.env.CLAUDECODE = '1'
    expect(isVsCodeProxy()).toBe(false)
  })

  test('returns true for any localhost port (port-agnostic, per D-02)', () => {
    process.env.ANTHROPIC_BASE_URL = 'http://localhost:8080'
    process.env.CLAUDE_CODE_ENTRYPOINT = 'sdk-ts'
    process.env.CLAUDECODE = '1'
    expect(isVsCodeProxy()).toBe(true)
  })

  test('returns false without throwing for malformed ANTHROPIC_BASE_URL', () => {
    process.env.ANTHROPIC_BASE_URL = 'not-a-url'
    process.env.CLAUDE_CODE_ENTRYPOINT = 'sdk-ts'
    process.env.CLAUDECODE = '1'
    expect(isVsCodeProxy()).toBe(false)
  })
})

describe('getAuthTokenSource - VS Code proxy bypass (D-02)', () => {
  test('returns ANTHROPIC_API_KEY source when proxy is active and key is set', () => {
    process.env.ANTHROPIC_BASE_URL = 'http://localhost:57760'
    process.env.CLAUDE_CODE_ENTRYPOINT = 'sdk-ts'
    process.env.CLAUDECODE = '1'
    process.env.ANTHROPIC_API_KEY = 'vscode-lm-anthropic.claude-opus-4-5-abc.def'
    const result = getAuthTokenSource()
    expect(result.source).toBe('ANTHROPIC_API_KEY')
    expect(result.hasToken).toBe(true)
  })

  test('falls through to none when proxy is active but ANTHROPIC_API_KEY is absent', () => {
    process.env.ANTHROPIC_BASE_URL = 'http://localhost:57760'
    process.env.CLAUDE_CODE_ENTRYPOINT = 'sdk-ts'
    process.env.CLAUDECODE = '1'
    delete process.env.ANTHROPIC_API_KEY
    const result = getAuthTokenSource()
    expect(result.source).toBe('none')
    expect(result.hasToken).toBe(false)
  })

  test('does not bypass when proxy env vars are absent (no regression)', () => {
    // beforeEach deletes ANTHROPIC_BASE_URL — proxy is off
    process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-some-key'
    const result = getAuthTokenSource()
    expect(result.source).toBe('none')
    expect(result.hasToken).toBe(false)
  })
})

describe('getAnthropicApiKeyWithSource - VS Code proxy bypass (D-01)', () => {
  test('returns env key directly when proxy is active and ANTHROPIC_API_KEY is set', () => {
    process.env.ANTHROPIC_BASE_URL = 'http://localhost:57760'
    process.env.CLAUDE_CODE_ENTRYPOINT = 'sdk-ts'
    process.env.CLAUDECODE = '1'
    process.env.ANTHROPIC_API_KEY = 'vscode-lm-anthropic.claude-opus-4-5-abc.def'
    const result = getAnthropicApiKeyWithSource()
    expect(result.key).toBe('vscode-lm-anthropic.claude-opus-4-5-abc.def')
    expect(result.source).toBe('ANTHROPIC_API_KEY')
  })
})
