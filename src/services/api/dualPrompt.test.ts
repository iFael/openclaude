import { test } from 'bun:test'
import assert from 'node:assert/strict'
import { adaptPromptForProvider, type ProviderHint } from './dualPrompt.js'

// ---------------------------------------------------------------------------
// Identity: generic provider returns original prompt unchanged
// ---------------------------------------------------------------------------

test('adaptPromptForProvider returns original prompt for generic provider', () => {
  const prompt = 'You are a helpful coding assistant.'
  const result = adaptPromptForProvider(prompt, 'generic')
  assert.equal(result, prompt)
})

// ---------------------------------------------------------------------------
// OpenAI adaptations
// ---------------------------------------------------------------------------

test('adaptPromptForProvider adds OpenAI-specific hints for openai provider', () => {
  const prompt = 'You are a helpful coding assistant.'
  const result = adaptPromptForProvider(prompt, 'openai')
  assert.notEqual(result, prompt)
  assert.ok(result.startsWith(prompt))
  assert.match(result, /tool_calls|function_call|tool/i)
})

test('adaptPromptForProvider preserves original content for openai', () => {
  const prompt = 'Custom instructions here with specific rules.'
  const result = adaptPromptForProvider(prompt, 'openai')
  assert.ok(result.includes(prompt))
})

// ---------------------------------------------------------------------------
// Gemini adaptations
// ---------------------------------------------------------------------------

test('adaptPromptForProvider adds Gemini-specific hints for gemini provider', () => {
  const prompt = 'You are a helpful coding assistant.'
  const result = adaptPromptForProvider(prompt, 'gemini')
  assert.notEqual(result, prompt)
  assert.ok(result.startsWith(prompt))
  assert.match(result, /grounding|multi-turn|context/i)
})

test('adaptPromptForProvider preserves original content for gemini', () => {
  const prompt = 'Custom instructions here with specific rules.'
  const result = adaptPromptForProvider(prompt, 'gemini')
  assert.ok(result.includes(prompt))
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test('adaptPromptForProvider handles empty prompt', () => {
  const result = adaptPromptForProvider('', 'openai')
  assert.ok(typeof result === 'string')
})

test('adaptPromptForProvider handles all valid provider hints', () => {
  const providers: ProviderHint[] = ['openai', 'gemini', 'generic']
  for (const p of providers) {
    const result = adaptPromptForProvider('test prompt', p)
    assert.ok(typeof result === 'string')
    assert.ok(result.length > 0)
  }
})
