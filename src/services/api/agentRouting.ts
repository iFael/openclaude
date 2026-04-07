import type { SettingsJson } from '../../utils/settings/types.js'

/**
 * Provider override resolved from agent routing config.
 * When present, the API client should use these instead of global env vars.
 */
export interface ProviderOverride {
  /** Model name to send to the API (e.g. "deepseek-chat", "gpt-4o") */
  model: string
  /** OpenAI-compatible base URL */
  baseURL: string
  /** API key for this provider */
  apiKey: string
}

/**
 * Normalize an agent identifier for case-insensitive, hyphen/underscore-agnostic matching.
 */
function normalize(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, '')
}

/**
 * Look up agent.routing by name or subagent_type, then resolve via agent.models.
 *
 * Priority: name > subagentType > "default" > null (use global provider)
 */
export function resolveAgentProvider(
  name: string | undefined,
  subagentType: string | undefined,
  settings: SettingsJson | null,
): ProviderOverride | null {
  if (!settings) return null

  const routing = settings.agentRouting
  const models = settings.agentModels
  if (!routing || !models) return null

  // Build normalized lookup from routing config.
  // Warn on duplicate normalized keys (e.g. "explore-agent" and "explore_agent"
  // both normalize to "exploreagent") to prevent silent shadowing.
  const normalizedRouting = new Map<string, string>()
  for (const [key, value] of Object.entries(routing)) {
    const nk = normalize(key)
    if (normalizedRouting.has(nk)) {
      console.error(`[agentRouting] Warning: routing key "${key}" collides with an existing key after normalization (both map to "${nk}"). First entry wins.`)
    }
    if (!normalizedRouting.has(nk)) {
      normalizedRouting.set(nk, value)
    }
  }

  // Try name first, then subagentType, then "default"
  const candidates = [name, subagentType, 'default'].filter(Boolean) as string[]
  let modelName: string | undefined

  for (const candidate of candidates) {
    const match = normalizedRouting.get(normalize(candidate))
    if (match) {
      modelName = match
      break
    }
  }

  if (!modelName) return null

  const modelConfig = models[modelName]
  if (!modelConfig) return null

  return {
    model: modelName,
    baseURL: modelConfig.base_url,
    apiKey: modelConfig.api_key,
  }
}

/**
 * Resolve an ordered fallback chain of providers for an agent.
 *
 * Returns [primary, fallback1, fallback2, ...] when the primary model's
 * config includes a `fallbacks` array. If no fallbacks are configured,
 * returns a single-element array. Returns an empty array when no match.
 */
export function resolveAgentProviderChain(
  name: string | undefined,
  subagentType: string | undefined,
  settings: SettingsJson | null,
): ProviderOverride[] {
  const primary = resolveAgentProvider(name, subagentType, settings)
  if (!primary) return []
  if (!settings?.agentModels) return [primary]

  const modelConfig = settings.agentModels[primary.model] as
    | { base_url: string; api_key: string; fallbacks?: string[] }
    | undefined
  if (!modelConfig?.fallbacks || modelConfig.fallbacks.length === 0) {
    return [primary]
  }

  const chain: ProviderOverride[] = [primary]
  const seen = new Set([primary.model])

  for (const fallbackModel of modelConfig.fallbacks) {
    if (seen.has(fallbackModel)) continue
    const fallbackConfig = settings.agentModels[fallbackModel]
    if (!fallbackConfig) continue
    seen.add(fallbackModel)
    chain.push({
      model: fallbackModel,
      baseURL: fallbackConfig.base_url,
      apiKey: fallbackConfig.api_key,
    })
  }

  return chain
}
