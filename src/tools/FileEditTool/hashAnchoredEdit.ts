import { createHash } from 'crypto'

/**
 * Compute a normalized hash for a single line of text.
 * Trims whitespace, collapses all internal whitespace to single spaces,
 * and returns a 16-char hex SHA-256 prefix.
 */
export function computeLineHash(line: string): string {
  const normalized = line.trim().replace(/\s+/g, ' ')
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

/**
 * Compute line-level hashes for a multi-line text.
 * Returns one hash per line.
 */
export function computeLineHashes(text: string): string[] {
  return text.split('\n').map(computeLineHash)
}

/**
 * Sliding-window search for a sequence of line hashes within a file's line hashes.
 * Returns the start and end line indices (inclusive) if found, or null.
 */
export function findByHashNeighborhood(
  fileHashes: string[],
  searchHashes: string[],
): { startLine: number; endLine: number } | null {
  if (searchHashes.length === 0) return null
  if (searchHashes.length > fileHashes.length) return null

  const windowSize = searchHashes.length

  for (let i = 0; i <= fileHashes.length - windowSize; i++) {
    let match = true
    for (let j = 0; j < windowSize; j++) {
      if (fileHashes[i + j] !== searchHashes[j]) {
        match = false
        break
      }
    }
    if (match) {
      return { startLine: i, endLine: i + windowSize - 1 }
    }
  }

  return null
}

/**
 * Hash-anchored match: find the actual substring in fileContent that
 * corresponds to searchString, tolerating whitespace and indentation
 * differences.
 *
 * Returns the actual file substring at the matched position, or null.
 */
export function hashAnchoredMatch(
  fileContent: string,
  searchString: string,
): string | null {
  const fileLines = fileContent.split('\n')
  const searchLines = searchString.split('\n')

  const fileHashes = fileLines.map(computeLineHash)
  const searchHashes = searchLines.map(computeLineHash)

  const location = findByHashNeighborhood(fileHashes, searchHashes)
  if (!location) return null

  const matchedLines = fileLines.slice(location.startLine, location.endLine + 1)
  return matchedLines.join('\n')
}
