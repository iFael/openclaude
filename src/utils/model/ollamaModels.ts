/**
 * Ollama model discovery for the /model picker.
 * Fetches available models from the Ollama API and caches them
 * so the synchronous getModelOptions() can use them.
 */

import type { ModelOption } from './modelOptions.js'
import { getOllamaApiBaseUrl } from '../providerDiscovery.js'

let cachedOllamaOptions: ModelOption[] | null = null
let fetchPromise: Promise<ModelOption[]> | null = null

/**
 * Stored original provider env vars so we can restore them
 * when switching back from Ollama to the original provider.
 */
let savedProviderEnv: Record<string, string | undefined> | null = null

/**
 * Returns true when the current OPENAI_BASE_URL points at an Ollama instance.
 * Detects OLLAMA_BASE_URL presence, /v1 suffixed URLs, and the raw base URL.
 */
export function isOllamaProvider(): boolean {
  // Explicit OLLAMA_BASE_URL is always sufficient
  if (process.env.OLLAMA_BASE_URL) return true
  if (!process.env.OPENAI_BASE_URL) return false
  const baseUrl = process.env.OPENAI_BASE_URL
  // Match common Ollama port
  try {
    const parsed = new URL(baseUrl)
    if (parsed.port === '11434') return true
  } catch {
    // ignore
  }
  return false
}

/**
 * Returns true if OLLAMA_BASE_URL is configured, meaning Ollama models
 * should be discoverable regardless of the active API provider.
 */
export function hasOllamaConfigured(): boolean {
  return Boolean(process.env.OLLAMA_BASE_URL)
}

/**
 * Check if a model value corresponds to a cached Ollama model.
 */
export function isOllamaModel(model: string | null): boolean {
  if (!model) return false
  const cached = getCachedOllamaModelOptions()
  return cached.some(opt => opt.value === model)
}

/**
 * Returns true if the provider was dynamically switched to Ollama.
 */
export function isInOllamaMode(): boolean {
  return savedProviderEnv !== null
}

/**
 * Switch process.env to route API requests through Ollama.
 * Saves the original provider env vars for later restoration.
 */
export function switchToOllamaProvider(): void {
  if (savedProviderEnv) return // already switched
  savedProviderEnv = {
    CLAUDE_CODE_USE_GITHUB: process.env.CLAUDE_CODE_USE_GITHUB,
    CLAUDE_CODE_USE_OPENAI: process.env.CLAUDE_CODE_USE_OPENAI,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  }
  const ollamaUrl = getOllamaApiBaseUrl()
  delete process.env.CLAUDE_CODE_USE_GITHUB
  process.env.CLAUDE_CODE_USE_OPENAI = '1'
  process.env.OPENAI_BASE_URL = `${ollamaUrl}/v1`
  process.env.OPENAI_API_KEY = 'ollama'
}

/**
 * Restore the original provider env vars after switching away from Ollama.
 */
export function restoreOriginalProvider(): void {
  if (!savedProviderEnv) return
  for (const [key, value] of Object.entries(savedProviderEnv)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  savedProviderEnv = null
}

/**
 * Fetch models from the Ollama /api/tags endpoint.
 */
export async function fetchOllamaModels(): Promise<ModelOption[]> {
  const apiUrl = getOllamaApiBaseUrl()
  if (!apiUrl) return []

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(`${apiUrl}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    })
    if (!response.ok) return []

    const data = (await response.json()) as {
      models?: Array<{
        name?: string
        size?: number
        details?: {
          parameter_size?: string
          quantization_level?: string
          family?: string
        }
      }>
    }

    return (data.models ?? [])
      .filter(m => Boolean(m.name))
      .map(m => {
        const paramSize = m.details?.parameter_size ?? ''
        const quant = m.details?.quantization_level ?? ''
        const sizeGB = m.size ? `${(m.size / 1e9).toFixed(1)}GB` : ''
        const parts = [paramSize, quant, sizeGB].filter(Boolean).join(' · ')
        return {
          value: m.name!,
          label: m.name!,
          description: parts ? `Ollama · ${parts}` : 'Ollama model',
        }
      })
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Prefetch and cache Ollama models. Call during startup.
 */
export function prefetchOllamaModels(): void {
  if (!isOllamaProvider() && !hasOllamaConfigured()) return
  if (cachedOllamaOptions && cachedOllamaOptions.length > 0) return
  if (fetchPromise) return
  fetchPromise = fetchOllamaModels()
    .then(options => {
      cachedOllamaOptions = options
      return options
    })
    .finally(() => {
      fetchPromise = null
    })
}

/**
 * Get cached Ollama model options (synchronous).
 * Returns empty array if not yet fetched.
 */
export function getCachedOllamaModelOptions(): ModelOption[] {
  return cachedOllamaOptions ?? []
}
