/**
 * VS Code proxy credential refresh utilities.
 *
 * When OpenClaude runs against the VS Code SDK proxy, the proxy port can change
 * between VS Code sessions. If the current ANTHROPIC_BASE_URL points to a dead
 * port (ECONNREFUSED), we re-read sdk-proxy-credentials.json to pick up the
 * new port the proxy is now listening on.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { isVsCodeProxy } from './auth.js'

const CREDENTIALS_PATH = join(homedir(), '.claude', 'sdk-proxy-credentials.json')

/**
 * Re-read sdk-proxy-credentials.json and update ANTHROPIC_BASE_URL /
 * ANTHROPIC_API_KEY if the file contains a different (newer) port.
 *
 * Returns true if credentials were actually updated, false otherwise.
 */
export function refreshVsCodeProxyCredentials(): boolean {
  if (!isVsCodeProxy()) return false

  try {
    const raw = readFileSync(CREDENTIALS_PATH, 'utf-8')
    const creds = JSON.parse(raw) as { baseUrl?: string; apiKey?: string }
    if (!creds.baseUrl || !creds.apiKey) return false

    const newUrl = creds.baseUrl.replace('://localhost', '://127.0.0.1')
    const currentUrl = process.env.ANTHROPIC_BASE_URL

    // Only update if the credentials actually changed
    if (newUrl === currentUrl && creds.apiKey === process.env.ANTHROPIC_API_KEY) {
      return false
    }

    // Validate loopback
    const parsed = new URL(newUrl)
    const loopback = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])
    if (!loopback.has(parsed.hostname.toLowerCase())) return false

    // Validate vscode-lm- prefix
    if (!String(creds.apiKey).startsWith('vscode-lm-')) return false

    process.env.ANTHROPIC_BASE_URL = newUrl
    process.env.ANTHROPIC_API_KEY = creds.apiKey
    return true
  } catch {
    return false
  }
}

/**
 * Check if the VS Code proxy is reachable at the current ANTHROPIC_BASE_URL.
 * Returns true if reachable, false if connection refused or timeout.
 */
export async function isVsCodeProxyAlive(): Promise<boolean> {
  if (!isVsCodeProxy()) return true // not proxy mode, skip check

  const baseUrl = process.env.ANTHROPIC_BASE_URL
  if (!baseUrl) return false

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const resp = await fetch(baseUrl, {
      method: 'HEAD',
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return resp.status < 500
  } catch {
    return false
  }
}

/**
 * Wait for the VS Code proxy to become available, re-reading credentials
 * on each attempt. Used at startup to handle the race condition where
 * openclaude starts before the proxy is ready.
 *
 * @param maxWaitMs Maximum time to wait (default 15s)
 * @param intervalMs How often to check (default 2s)
 * @returns true if proxy became available, false if timed out
 */
export async function waitForVsCodeProxy(
  maxWaitMs = 15000,
  intervalMs = 2000,
): Promise<boolean> {
  if (!isVsCodeProxy()) return true

  const deadline = Date.now() + maxWaitMs

  while (Date.now() < deadline) {
    // Try current credentials first
    if (await isVsCodeProxyAlive()) return true

    // Credentials might be stale — re-read and try again
    refreshVsCodeProxyCredentials()

    if (await isVsCodeProxyAlive()) return true

    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }

  return false
}
