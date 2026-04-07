/**
 * Returns true only if the URL points to a loopback address.
 * Prevents SSRF and credential exfiltration by rejecting non-local URLs.
 */
export declare function isLoopbackUrl(url: string): boolean;
/**
 * Validates a launch command for shell safety.
 * Returns null if the command contains dangerous metacharacters.
 * Returns the trimmed command string if safe.
 */
export declare function sanitizeLaunchCommand(command: string): string | null;
/**
 * Constant-time string comparison to prevent timing attacks on API keys.
 * Falls back to === if inputs have different lengths (which already leaks
 * length — but length is not secret for our API key format).
 */
export declare function timingSafeEqual(a: string, b: string): boolean;
/**
 * Read a file securely:
 * - Rejects symbolic links (prevents symlink redirection attacks)
 * - No TOCTOU race (single readFileSync in try/catch, no existsSync)
 * - Returns null on any failure (missing file, permission error, symlink)
 */
export declare function readFileSecurely(filePath: string): string | null;
/**
 * Validates that the Host header is a loopback address.
 * Prevents DNS rebinding attacks where a malicious website resolves to
 * 127.0.0.1 and accesses the proxy via the browser.
 */
export declare function isValidHostHeader(host: string | undefined): boolean;
//# sourceMappingURL=security.d.ts.map
