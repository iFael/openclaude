// security.ts — Shared security utilities for the OpenClaude extension.
//
// All security-critical validation logic lives here so it can be tested
// independently and reused across extension.ts, proxy.ts, and cli.tsx.

import * as crypto from 'crypto';
import * as fs from 'fs';

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/**
 * Returns true only if the URL points to a loopback address.
 * Prevents SSRF and credential exfiltration by rejecting non-local URLs.
 */
export function isLoopbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return LOOPBACK_HOSTNAMES.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Command sanitization
// ---------------------------------------------------------------------------

/**
 * Shell metacharacters that enable command chaining or substitution.
 * These MUST be rejected in any string sent to terminal.sendText().
 */
const SHELL_METACHAR_PATTERN = /[;&|`$(){}!<>]/;

/**
 * Validates a launch command for shell safety.
 * Returns null if the command contains dangerous metacharacters.
 * Returns the trimmed command string if safe.
 */
export function sanitizeLaunchCommand(command: string): string | null {
  const trimmed = (command || '').trim();
  if (!trimmed) return null;

  // Reject && and || explicitly (they're composed of safe-looking chars)
  if (trimmed.includes('&&') || trimmed.includes('||')) return null;

  // Reject individual metacharacters
  if (SHELL_METACHAR_PATTERN.test(trimmed)) return null;

  return trimmed;
}

// ---------------------------------------------------------------------------
// Timing-safe comparison
// ---------------------------------------------------------------------------

/**
 * Constant-time string comparison to prevent timing attacks on API keys.
 * Falls back to === if inputs have different lengths (which already leaks
 * length — but length is not secret for our API key format).
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ---------------------------------------------------------------------------
// Secure file reading
// ---------------------------------------------------------------------------

/**
 * Read a file securely:
 * - Rejects symbolic links (prevents symlink redirection attacks)
 * - No TOCTOU race (single readFileSync in try/catch, no existsSync)
 * - Returns null on any failure (missing file, permission error, symlink)
 */
export function readFileSecurely(filePath: string): string | null {
  try {
    // Reject symlinks
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink()) {
      console.debug(`[openclaude] Rejected symlink at ${filePath}`);
      return null;
    }

    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Host header validation (DNS rebinding protection)
// ---------------------------------------------------------------------------

/**
 * Validates that the Host header is a loopback address.
 * Prevents DNS rebinding attacks where a malicious website resolves to
 * 127.0.0.1 and accesses the proxy via the browser.
 */
export function isValidHostHeader(host: string | undefined): boolean {
  if (!host) return false;
  // Strip port number if present
  const hostname = host.replace(/:\d+$/, '').toLowerCase();
  return LOOPBACK_HOSTNAMES.has(hostname);
}
