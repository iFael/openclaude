import { test } from 'bun:test'
import assert from 'node:assert/strict'
import {
  computeLineHash,
  computeLineHashes,
  findByHashNeighborhood,
  hashAnchoredMatch,
} from './hashAnchoredEdit.js'

// ---------------------------------------------------------------------------
// computeLineHash
// ---------------------------------------------------------------------------

test('computeLineHash produces consistent hash for identical input', () => {
  const h1 = computeLineHash('const x = 1;')
  const h2 = computeLineHash('const x = 1;')
  assert.equal(h1, h2)
})

test('computeLineHash normalizes leading/trailing whitespace', () => {
  const h1 = computeLineHash('  const x = 1;  ')
  const h2 = computeLineHash('const x = 1;')
  assert.equal(h1, h2)
})

test('computeLineHash treats tabs and spaces as equivalent', () => {
  const h1 = computeLineHash('\tconst x = 1;')
  const h2 = computeLineHash('    const x = 1;')
  assert.equal(h1, h2)
})

test('computeLineHash collapses multiple spaces into one', () => {
  const h1 = computeLineHash('const   x   =   1;')
  const h2 = computeLineHash('const x = 1;')
  assert.equal(h1, h2)
})

test('computeLineHash returns a 16-char hex string', () => {
  const h = computeLineHash('hello world')
  assert.equal(h.length, 16)
  assert.match(h, /^[0-9a-f]{16}$/)
})

test('computeLineHash produces different hashes for different content', () => {
  const h1 = computeLineHash('const x = 1;')
  const h2 = computeLineHash('const y = 2;')
  assert.notEqual(h1, h2)
})

// ---------------------------------------------------------------------------
// computeLineHashes
// ---------------------------------------------------------------------------

test('computeLineHashes returns one hash per line', () => {
  const hashes = computeLineHashes('line1\nline2\nline3')
  assert.equal(hashes.length, 3)
})

test('computeLineHashes handles single line', () => {
  const hashes = computeLineHashes('single line')
  assert.equal(hashes.length, 1)
})

test('computeLineHashes handles empty string', () => {
  const hashes = computeLineHashes('')
  assert.equal(hashes.length, 1)
})

// ---------------------------------------------------------------------------
// findByHashNeighborhood
// ---------------------------------------------------------------------------

test('findByHashNeighborhood finds exact location in file', () => {
  const fileHashes = computeLineHashes('aaa\nbbb\nccc\nddd\neee')
  const searchHashes = computeLineHashes('bbb\nccc\nddd')
  const result = findByHashNeighborhood(fileHashes, searchHashes)
  assert.ok(result)
  assert.equal(result.startLine, 1)
  assert.equal(result.endLine, 3)
})

test('findByHashNeighborhood matches despite whitespace differences', () => {
  const fileHashes = computeLineHashes('  aaa\n\tbbb\n    ccc')
  const searchHashes = computeLineHashes('bbb\nccc')
  const result = findByHashNeighborhood(fileHashes, searchHashes)
  assert.ok(result)
  assert.equal(result.startLine, 1)
  assert.equal(result.endLine, 2)
})

test('findByHashNeighborhood returns null when no match', () => {
  const fileHashes = computeLineHashes('aaa\nbbb\nccc')
  const searchHashes = computeLineHashes('xxx\nyyy')
  const result = findByHashNeighborhood(fileHashes, searchHashes)
  assert.equal(result, null)
})

test('findByHashNeighborhood finds match at start of file', () => {
  const fileHashes = computeLineHashes('aaa\nbbb\nccc')
  const searchHashes = computeLineHashes('aaa\nbbb')
  const result = findByHashNeighborhood(fileHashes, searchHashes)
  assert.ok(result)
  assert.equal(result.startLine, 0)
  assert.equal(result.endLine, 1)
})

test('findByHashNeighborhood finds match at end of file', () => {
  const fileHashes = computeLineHashes('aaa\nbbb\nccc')
  const searchHashes = computeLineHashes('bbb\nccc')
  const result = findByHashNeighborhood(fileHashes, searchHashes)
  assert.ok(result)
  assert.equal(result.startLine, 1)
  assert.equal(result.endLine, 2)
})

// ---------------------------------------------------------------------------
// hashAnchoredMatch (integration)
// ---------------------------------------------------------------------------

test('hashAnchoredMatch returns correct substring when whitespace differs', () => {
  const fileContent = '  function foo() {\n    return 1;\n  }'
  const searchString = 'function foo() {\n  return 1;\n}'
  const result = hashAnchoredMatch(fileContent, searchString)
  assert.ok(result)
  assert.equal(result, fileContent)
})

test('hashAnchoredMatch returns null for genuinely different content', () => {
  const fileContent = 'function foo() {\n  return 1;\n}'
  const searchString = 'function bar() {\n  return 2;\n}'
  const result = hashAnchoredMatch(fileContent, searchString)
  assert.equal(result, null)
})

test('hashAnchoredMatch handles single-line old_string', () => {
  const fileContent = 'line1\n  const x = 42;\nline3'
  const searchString = 'const x = 42;'
  const result = hashAnchoredMatch(fileContent, searchString)
  assert.ok(result)
  assert.match(result, /const x = 42;/)
})

test('hashAnchoredMatch handles tab vs space indentation', () => {
  const fileContent = '\tif (true) {\n\t\treturn false;\n\t}'
  const searchString = '    if (true) {\n        return false;\n    }'
  const result = hashAnchoredMatch(fileContent, searchString)
  assert.ok(result)
  assert.equal(result, fileContent)
})

test('hashAnchoredMatch returns null for partial overlap', () => {
  const fileContent = 'aaa\nbbb\nccc\nddd'
  const searchString = 'bbb\nxxx\nddd'
  const result = hashAnchoredMatch(fileContent, searchString)
  assert.equal(result, null)
})
