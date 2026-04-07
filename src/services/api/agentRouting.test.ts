import { describe, expect, test } from 'bun:test'
import { resolveAgentProvider, resolveAgentProviderChain } from './agentRouting.js'
import type { SettingsJson } from '../../utils/settings/types.js'

const baseSettings = {
  agentModels: {
    'deepseek-chat': { base_url: 'https://api.deepseek.com/v1', api_key: 'sk-ds' },
    'gpt-4o': { base_url: 'https://api.openai.com/v1', api_key: 'sk-oai' },
  },
  agentRouting: {
    Explore: 'deepseek-chat',
    'general-purpose': 'gpt-4o',
    'frontend-dev': 'deepseek-chat',
    default: 'gpt-4o',
  },
} as unknown as SettingsJson

describe('resolveAgentProvider', () => {
  // ── Priority chain ──────────────────────────────────────────

  test('name takes priority over subagentType', () => {
    const result = resolveAgentProvider('frontend-dev', 'Explore', baseSettings)
    expect(result).toEqual({
      model: 'deepseek-chat',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-ds',
    })
  })

  test('subagentType used when name has no match', () => {
    const result = resolveAgentProvider('unknown-name', 'Explore', baseSettings)
    expect(result).toEqual({
      model: 'deepseek-chat',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-ds',
    })
  })

  test('falls back to "default" when neither name nor subagentType match', () => {
    const result = resolveAgentProvider('nobody', 'unknown-type', baseSettings)
    expect(result).toEqual({
      model: 'gpt-4o',
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-oai',
    })
  })

  test('returns null when no routing match and no default', () => {
    const settings = {
      agentModels: baseSettings.agentModels,
      agentRouting: { Explore: 'deepseek-chat' },
    } as unknown as SettingsJson
    const result = resolveAgentProvider('nobody', 'unknown-type', settings)
    expect(result).toBeNull()
  })

  test('returns null when name and subagentType are both undefined', () => {
    const settings = {
      agentModels: baseSettings.agentModels,
      agentRouting: { Explore: 'deepseek-chat' },
    } as unknown as SettingsJson
    const result = resolveAgentProvider(undefined, undefined, settings)
    expect(result).toBeNull()
  })

  // ── normalize() matching ────────────────────────────────────

  test('matching is case-insensitive', () => {
    const result = resolveAgentProvider(undefined, 'explore', baseSettings)
    expect(result?.model).toBe('deepseek-chat')
  })

  test('matching is case-insensitive (UPPER)', () => {
    const result = resolveAgentProvider(undefined, 'EXPLORE', baseSettings)
    expect(result?.model).toBe('deepseek-chat')
  })

  test('hyphen and underscore are equivalent', () => {
    const result = resolveAgentProvider(undefined, 'general_purpose', baseSettings)
    expect(result?.model).toBe('gpt-4o')
  })

  test('underscore in config matches hyphen in input', () => {
    const settings = {
      agentModels: baseSettings.agentModels,
      agentRouting: { general_purpose: 'deepseek-chat' },
    } as unknown as SettingsJson
    const result = resolveAgentProvider(undefined, 'general-purpose', settings)
    expect(result?.model).toBe('deepseek-chat')
  })

  // ── Edge cases ──────────────────────────────────────────────

  test('returns null when settings is null', () => {
    expect(resolveAgentProvider('Explore', 'Explore', null)).toBeNull()
  })

  test('returns null when agentRouting is missing', () => {
    const settings = { agentModels: baseSettings.agentModels } as unknown as SettingsJson
    expect(resolveAgentProvider(undefined, 'Explore', settings)).toBeNull()
  })

  test('returns null when agentModels is missing', () => {
    const settings = { agentRouting: baseSettings.agentRouting } as unknown as SettingsJson
    expect(resolveAgentProvider(undefined, 'Explore', settings)).toBeNull()
  })

  test('returns null when routing references non-existent model', () => {
    const settings = {
      agentModels: {},
      agentRouting: { Explore: 'non-existent-model' },
    } as unknown as SettingsJson
    expect(resolveAgentProvider(undefined, 'Explore', settings)).toBeNull()
  })

  test('subagentType only (no name)', () => {
    const result = resolveAgentProvider(undefined, 'Explore', baseSettings)
    expect(result?.model).toBe('deepseek-chat')
  })

  test('name only (no subagentType)', () => {
    const result = resolveAgentProvider('frontend-dev', undefined, baseSettings)
    expect(result?.model).toBe('deepseek-chat')
  })
})

describe('resolveAgentProviderChain', () => {
  test('returns single-element array when no fallbacks configured', () => {
    const chain = resolveAgentProviderChain('frontend-dev', undefined, baseSettings)
    expect(chain).toHaveLength(1)
    expect(chain[0].model).toBe('deepseek-chat')
  })

  test('returns ordered chain with primary + fallbacks', () => {
    const settings = {
      agentRouting: { default: 'deepseek-chat' },
      agentModels: {
        'deepseek-chat': {
          base_url: 'https://api.deepseek.com/v1',
          api_key: 'sk-ds',
          fallbacks: ['gpt-4o', 'gemini-pro'],
        },
        'gpt-4o': { base_url: 'https://api.openai.com/v1', api_key: 'sk-oai' },
        'gemini-pro': {
          base_url: 'https://generativelanguage.googleapis.com/v1',
          api_key: 'gm-key',
        },
      },
    } as unknown as SettingsJson
    const chain = resolveAgentProviderChain('agent', undefined, settings)
    expect(chain).toHaveLength(3)
    expect(chain[0].model).toBe('deepseek-chat')
    expect(chain[1].model).toBe('gpt-4o')
    expect(chain[2].model).toBe('gemini-pro')
  })

  test('skips fallback models not present in agentModels', () => {
    const settings = {
      agentRouting: { default: 'gpt-4o' },
      agentModels: {
        'gpt-4o': {
          base_url: 'https://api.openai.com/v1',
          api_key: 'sk-test',
          fallbacks: ['nonexistent', 'also-missing'],
        },
      },
    } as unknown as SettingsJson
    const chain = resolveAgentProviderChain('agent', undefined, settings)
    expect(chain).toHaveLength(1)
    expect(chain[0].model).toBe('gpt-4o')
  })

  test('deduplicates models in chain', () => {
    const settings = {
      agentRouting: { default: 'gpt-4o' },
      agentModels: {
        'gpt-4o': {
          base_url: 'https://api.openai.com/v1',
          api_key: 'sk-test',
          fallbacks: ['gpt-4o', 'gpt-4o'],
        },
      },
    } as unknown as SettingsJson
    const chain = resolveAgentProviderChain('agent', undefined, settings)
    expect(chain).toHaveLength(1)
  })

  test('returns empty array when no routing match', () => {
    const settings = {
      agentRouting: {},
      agentModels: {
        'gpt-4o': { base_url: 'https://api.openai.com/v1', api_key: 'sk-test' },
      },
    } as unknown as SettingsJson
    const chain = resolveAgentProviderChain('nomatch', undefined, settings)
    expect(chain).toHaveLength(0)
  })

  test('returns empty array when settings is null', () => {
    const chain = resolveAgentProviderChain('agent', undefined, null)
    expect(chain).toHaveLength(0)
  })

  test('preserves provider details for each fallback', () => {
    const settings = {
      agentRouting: { default: 'primary' },
      agentModels: {
        primary: {
          base_url: 'https://primary.com/v1',
          api_key: 'pk-1',
          fallbacks: ['secondary'],
        },
        secondary: {
          base_url: 'https://secondary.com/v1',
          api_key: 'sk-2',
        },
      },
    } as unknown as SettingsJson
    const chain = resolveAgentProviderChain('agent', undefined, settings)
    expect(chain).toHaveLength(2)
    expect(chain[0]).toEqual({ model: 'primary', baseURL: 'https://primary.com/v1', apiKey: 'pk-1' })
    expect(chain[1]).toEqual({ model: 'secondary', baseURL: 'https://secondary.com/v1', apiKey: 'sk-2' })
  })
})
