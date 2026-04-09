/**
 * AgentChat startup screen — modern slim design with cyan-to-blue gradient.
 * Called once at CLI startup before the Ink UI renders.
 */

import { isLocalProviderUrl } from '../services/api/providerConfig.js'
import { isVsCodeProxy } from '../utils/auth.js'
import { getLocalOpenAICompatibleProviderLabel } from '../utils/providerDiscovery.js'

declare const MACRO: { VERSION: string; DISPLAY_VERSION?: string }

const ESC = '\x1b['
const RESET = `${ESC}0m`
const DIM = `${ESC}2m`
const BOLD = `${ESC}1m`

type RGB = [number, number, number]
const rgb = (r: number, g: number, b: number) => `${ESC}38;2;${r};${g};${b}m`

function lerp(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

function gradAt(stops: RGB[], t: number): RGB {
  const c = Math.max(0, Math.min(1, t))
  const s = c * (stops.length - 1)
  const i = Math.floor(s)
  if (i >= stops.length - 1) return stops[stops.length - 1]
  return lerp(stops[i], stops[i + 1], s - i)
}

function paintLine(text: string, stops: RGB[], lineT: number): string {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const t = text.length > 1 ? lineT * 0.4 + (i / (text.length - 1)) * 0.6 : lineT
    const [r, g, b] = gradAt(stops, t)
    out += `${rgb(r, g, b)}${text[i]}`
  }
  return out + RESET
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const CYAN_GRAD: RGB[] = [
  [0, 255, 255],
  [0, 210, 240],
  [0, 170, 220],
  [0, 130, 200],
  [0, 90, 170],
  [0, 60, 140],
]

const ACCENT: RGB = [0, 230, 230]
const CREAM: RGB = [190, 220, 240]
const DIMCOL: RGB = [70, 105, 130]
const BORDER: RGB = [50, 90, 120]
const HIGHLIGHT: RGB = [120, 220, 255]

// ─── Block Logo — AGENT CHAT ─────────────────────────────────────────────────

const LOGO_AGENT = [
  '  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557  \u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557',
  '  \u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2551 \u2588\u2588\u2554\u2550\u2550\u2550\u2550\u2550\u255d \u2588\u2588\u2554\u2550\u2550\u2550\u2550\u2550\u255d \u2588\u2588\u2588\u2557 \u2588\u2588\u2551 \u255a\u2550\u2588\u2588\u2554\u2550\u2550\u255d',
  '  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551 \u2588\u2588\u2551 \u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557   \u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551    \u2588\u2588\u2551   ',
  '  \u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2551 \u2588\u2588\u2551  \u2588\u2588\u2551 \u2588\u2588\u2554\u2550\u2550\u2550\u255d   \u2588\u2588\u2554\u2588\u2588\u2588\u2588\u2551    \u2588\u2588\u2551   ',
  '  \u2588\u2588\u2551   \u2588\u2588\u2551 \u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2551 \u255a\u2588\u2588\u2588\u2551    \u2588\u2588\u2551   ',
  '  \u255a\u2550\u255d   \u255a\u2550\u255d  \u255a\u2550\u2550\u2550\u2550\u2550\u255d  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u255d  \u255a\u2550\u2550\u255d    \u255a\u2550\u255d   ',
]

const LOGO_CHAT = [
  '  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557  \u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557',
  '  \u2588\u2588\u2554\u2550\u2550\u2550\u2550\u2550\u255d \u2588\u2588\u2551  \u2588\u2588\u2551 \u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2551 \u255a\u2550\u2588\u2588\u2554\u2550\u2550\u255d',
  '  \u2588\u2588\u2551       \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551   \u2588\u2588\u2551   ',
  '  \u2588\u2588\u2551       \u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2551 \u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2551   \u2588\u2588\u2551   ',
  '  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2551   \u2588\u2588\u2551 \u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2551   ',
  '  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u255d   \u255a\u2550\u255d \u255a\u2550\u255d   \u255a\u2550\u255d   \u255a\u2550\u255d   ',
]

// ─── Provider detection ───────────────────────────────────────────────────────

function detectProvider(): { name: string; model: string; baseUrl: string; isLocal: boolean } {
  const useGemini = process.env.CLAUDE_CODE_USE_GEMINI === '1' || process.env.CLAUDE_CODE_USE_GEMINI === 'true'
  const useGithub = process.env.CLAUDE_CODE_USE_GITHUB === '1' || process.env.CLAUDE_CODE_USE_GITHUB === 'true'
  const useOpenAI = process.env.CLAUDE_CODE_USE_OPENAI === '1' || process.env.CLAUDE_CODE_USE_OPENAI === 'true'

  if (useGemini) {
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    const baseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai'
    return { name: 'Google Gemini', model, baseUrl, isLocal: false }
  }

  if (useGithub) {
    const model = process.env.OPENAI_MODEL || 'github:copilot'
    const baseUrl =
      process.env.OPENAI_BASE_URL || 'https://models.github.ai/inference'
    return { name: 'GitHub Models', model, baseUrl, isLocal: false }
  }

  if (useOpenAI) {
    const rawModel = process.env.OPENAI_MODEL || 'gpt-4o'
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    const isLocal = isLocalProviderUrl(baseUrl)
    let name = 'OpenAI'
    if (/deepseek/i.test(baseUrl) || /deepseek/i.test(rawModel))       name = 'DeepSeek'
    else if (/openrouter/i.test(baseUrl))                             name = 'OpenRouter'
    else if (/together/i.test(baseUrl))                               name = 'Together AI'
    else if (/groq/i.test(baseUrl))                                   name = 'Groq'
    else if (/mistral/i.test(baseUrl) || /mistral/i.test(rawModel))     name = 'Mistral'
    else if (/azure/i.test(baseUrl))                                  name = 'Azure OpenAI'
    else if (/llama/i.test(rawModel))                                    name = 'Meta Llama'
    else if (isLocal)                                                  name = getLocalOpenAICompatibleProviderLabel(baseUrl)

    let displayModel = rawModel
    const codexAliases: Record<string, { model: string; reasoningEffort?: string }> = {
      codexplan: { model: 'gpt-5.4', reasoningEffort: 'high' },
      'gpt-5.4': { model: 'gpt-5.4', reasoningEffort: 'high' },
      'gpt-5.3-codex': { model: 'gpt-5.3-codex', reasoningEffort: 'high' },
      'gpt-5.3-codex-spark': { model: 'gpt-5.3-codex-spark' },
      codexspark: { model: 'gpt-5.3-codex-spark' },
      'gpt-5.2-codex': { model: 'gpt-5.2-codex', reasoningEffort: 'high' },
      'gpt-5.1-codex-max': { model: 'gpt-5.1-codex-max', reasoningEffort: 'high' },
      'gpt-5.1-codex-mini': { model: 'gpt-5.1-codex-mini' },
      'gpt-5.4-mini': { model: 'gpt-5.4-mini', reasoningEffort: 'medium' },
      'gpt-5.2': { model: 'gpt-5.2', reasoningEffort: 'medium' },
    }
    const alias = rawModel.toLowerCase()
    if (alias in codexAliases) {
      const resolved = codexAliases[alias]
      displayModel = resolved.model
      if (resolved.reasoningEffort) {
        displayModel = `${displayModel} (${resolved.reasoningEffort})`
      }
    }

    return { name, model: displayModel, baseUrl, isLocal }
  }

  const model = process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'
  const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'
  if (isVsCodeProxy()) {
    return { name: 'VS Code Proxy (Copilot Pro+)', model, baseUrl, isLocal: true }
  }
  return { name: 'Anthropic', model, baseUrl, isLocal: false }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function printStartupScreen(): void {
  if (process.env.CI || !process.stdout.isTTY) return

  const p = detectProvider()
  const out: string[] = []
  const ver = MACRO.DISPLAY_VERSION ?? MACRO.VERSION

  out.push('')

  // ─── Top border ───
  out.push(`  ${rgb(...BORDER)}╔${'═'.repeat(44)}╗${RESET}`)
  out.push(`  ${rgb(...BORDER)}║${' '.repeat(44)}║${RESET}`)

  // ─── Logo AGENT ───
  const allLogo = [...LOGO_AGENT, '', ...LOGO_CHAT]
  const total = allLogo.length
  for (let i = 0; i < total; i++) {
    const t = total > 1 ? i / (total - 1) : 0
    if (allLogo[i] === '') {
      out.push(`  ${rgb(...BORDER)}║${' '.repeat(44)}║${RESET}`)
    } else {
      const painted = paintLine(allLogo[i], CYAN_GRAD, t)
      const rawLen = allLogo[i].length
      const pad = Math.max(0, 44 - rawLen)
      out.push(`  ${rgb(...BORDER)}║${RESET}${painted}${' '.repeat(pad)}${rgb(...BORDER)}║${RESET}`)
    }
  }

  out.push(`  ${rgb(...BORDER)}║${' '.repeat(44)}║${RESET}`)

  // ─── Tagline ───
  const tag1 = '── Conectando mentes. Sem fronteiras. ──'
  const tag1Pad = Math.floor((44 - tag1.length) / 2)
  out.push(`  ${rgb(...BORDER)}║${RESET}${' '.repeat(tag1Pad)}${rgb(...HIGHLIGHT)}${tag1}${RESET}${' '.repeat(44 - tag1Pad - tag1.length)}${rgb(...BORDER)}║${RESET}`)

  out.push(`  ${rgb(...BORDER)}║${' '.repeat(44)}║${RESET}`)
  out.push(`  ${rgb(...BORDER)}╚${'═'.repeat(44)}╝${RESET}`)

  out.push('')

  // ─── Provider info — tree format ───
  const treeColor = rgb(...BORDER)
  const lblColor = rgb(...DIMCOL)
  const valColor = rgb(...CREAM)
  const accentColor = rgb(...ACCENT)

  const ep = p.baseUrl.length > 28 ? p.baseUrl.slice(0, 25) + '...' : p.baseUrl
  const sC = p.isLocal ? rgb(100, 200, 150) : rgb(...ACCENT)
  const sL = p.isLocal ? 'local' : 'nuvem'

  out.push(`  ${treeColor}┌─${RESET} ${lblColor}Provedor${RESET}  ${treeColor}───${RESET} ${valColor}${p.name}${RESET}`)
  out.push(`  ${treeColor}├─${RESET} ${lblColor}Servidor${RESET}  ${treeColor}───${RESET} ${valColor}${ep}${RESET}`)
  out.push(`  ${treeColor}└─${RESET} ${sC}●${RESET} ${lblColor}${sL}${RESET}     ${treeColor}───${RESET} ${DIM}${lblColor}Pronto ${RESET}${treeColor}│${RESET} ${accentColor}/help${RESET}`)

  out.push('')
  out.push(`  ${DIM}${rgb(...DIMCOL)}agentchat${RESET} ${accentColor}v${ver}${RESET}`)
  out.push('')

  process.stdout.write(out.join('\n') + '\n')
}
