/**
 * postinstall-patch-ps1.ts
 *
 * Patches the npm-generated openclaude.ps1 wrapper to handle protected
 * directories (e.g. C:\Windows\System32) where Node.exe gets "Access Denied"
 * because it cannot start with that CWD.
 *
 * Run automatically via "postinstall" in package.json.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const npmBin = process.env.npm_config_prefix
  ? join(process.env.npm_config_prefix, 'openclaude.ps1')
  : null

// Also check the common global npm path on Windows
const candidates = [
  npmBin,
  join(process.env.APPDATA || '', 'npm', 'openclaude.ps1'),
].filter((p): p is string => !!p && existsSync(p))

const patch = `# Avoid 'Access Denied' when CWD is a protected OS directory (e.g. System32).
# Node.exe cannot start with these directories as working directory.
$cwd = (Get-Location).Path
if ($cwd -like "$env:SystemRoot*" -or $cwd -like "$env:ProgramFiles*" -or $cwd -like "\${env:ProgramFiles(x86)}*" -or $cwd -like "$env:windir*") {
  Set-Location $HOME
}`

for (const ps1Path of candidates) {
  try {
    const content = readFileSync(ps1Path, 'utf-8')
    if (content.includes('SystemRoot')) continue // already patched
    // Insert patch after the $exe block
    const patched = content.replace(
      /(\$exe="\.exe"\r?\n\})\r?\n/,
      `$1\n\n${patch}\n\n`,
    )
    if (patched !== content) {
      writeFileSync(ps1Path, patched, 'utf-8')
    }
  } catch {
    // Best-effort — skip if inaccessible
  }
}
