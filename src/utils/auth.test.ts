import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { isVsCodeProxy } from './auth.js'

const RESET_KEY = 'ANTHROPIC_API_KEY'
const originalValue = process.env[RESET_KEY]

beforeEach(() => {
  delete process.env[RESET_KEY]
})

afterEach(() => {
  if (originalValue === undefined) delete process.env[RESET_KEY]
  else process.env[RESET_KEY] = originalValue
})

describe('isVsCodeProxy', () => {
  test('returns true when ANTHROPIC_API_KEY starts with vscode-lm-', () => {
    process.env.ANTHROPIC_API_KEY = 'vscode-lm-abc123'
    expect(isVsCodeProxy()).toBe(true)
  })

  test('returns true for any vscode-lm- prefixed token', () => {
    process.env.ANTHROPIC_API_KEY = 'vscode-lm-copilot-xyz-session-token'
    expect(isVsCodeProxy()).toBe(true)
  })

  test('returns false when ANTHROPIC_API_KEY is a standard sk- key', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-abc123'
    expect(isVsCodeProxy()).toBe(false)
  })

  test('returns false when ANTHROPIC_API_KEY is not set', () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(isVsCodeProxy()).toBe(false)
  })

  test('returns false when ANTHROPIC_API_KEY is an empty string', () => {
    process.env.ANTHROPIC_API_KEY = ''
    expect(isVsCodeProxy()).toBe(false)
  })

  test('returns false for a key that contains vscode-lm- but does not start with it', () => {
    process.env.ANTHROPIC_API_KEY = 'prefix-vscode-lm-token'
    expect(isVsCodeProxy()).toBe(false)
  })
})
