import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { isVsCodeProxy } from './auth.js'

const RESET_KEYS = [
  'ANTHROPIC_BASE_URL',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDECODE',
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
