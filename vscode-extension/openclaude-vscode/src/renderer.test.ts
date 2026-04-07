import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { escapeHtml, getToneClass, renderControlCenterHtml, renderErrorHtml } from './renderer';

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------

test('escapeHtml escapes ampersand', () => {
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
});

test('escapeHtml escapes less-than', () => {
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
});

test('escapeHtml escapes greater-than', () => {
  assert.equal(escapeHtml('x > y'), 'x &gt; y');
});

test('escapeHtml escapes double quotes', () => {
  assert.equal(escapeHtml('say "hello"'), 'say &quot;hello&quot;');
});

test('escapeHtml escapes single quotes', () => {
  assert.equal(escapeHtml("it's"), 'it&#39;s');
});

test('escapeHtml escapes all 5 special chars in a single string', () => {
  assert.equal(escapeHtml(`& < > " '`), '&amp; &lt; &gt; &quot; &#39;');
});

test('escapeHtml coerces non-string values to string', () => {
  assert.equal(escapeHtml(42), '42');
  assert.equal(escapeHtml(null), 'null');
  assert.equal(escapeHtml(undefined), 'undefined');
});

// ---------------------------------------------------------------------------
// renderErrorHtml — Error object
// ---------------------------------------------------------------------------

test('renderErrorHtml renders the error message from an Error object', () => {
  const html = renderErrorHtml(new Error('Something went wrong'));
  assert.ok(html.includes('Something went wrong'));
  assert.ok(html.includes('Control Center Error'));
});

test('renderErrorHtml uses fallback message for a non-Error value', () => {
  const html = renderErrorHtml('plain string');
  assert.ok(html.includes('Unknown Control Center error'));
});

test('renderErrorHtml uses fallback message for null', () => {
  const html = renderErrorHtml(null);
  assert.ok(html.includes('Unknown Control Center error'));
});

test('renderErrorHtml includes a CSP meta tag with a nonce', () => {
  const html = renderErrorHtml(new Error('test'));
  const cspMatch = html.match(/script-src 'nonce-([A-Za-z0-9+/=]+)'/);
  assert.ok(cspMatch, 'CSP meta tag with nonce must be present');
  assert.ok(cspMatch![1].length > 0, 'nonce must not be empty');
});

test('renderErrorHtml nonce in CSP matches nonce on script tag', () => {
  const html = renderErrorHtml(new Error('test'));
  const cspNonce = html.match(/script-src 'nonce-([A-Za-z0-9+/=]+)'/);
  const scriptNonce = html.match(/<script nonce="([A-Za-z0-9+/=]+)">/);
  assert.ok(cspNonce && scriptNonce, 'both nonce locations must exist');
  assert.equal(cspNonce![1], scriptNonce![1], 'nonces must match');
});

test('renderErrorHtml includes a refresh button', () => {
  const html = renderErrorHtml(new Error('test'));
  assert.ok(html.includes('id="refresh"'));
  assert.ok(html.includes("type: 'refresh'"));
});

// ---------------------------------------------------------------------------
// renderControlCenterHtml — minimal status
// ---------------------------------------------------------------------------

function createMinimalStatus() {
  return {
    installed: true,
    executable: 'openclaude',
    providerState: { label: 'Anthropic', source: 'env', detail: 'from environment' },
    providerSourceLabel: 'environment',
    workspaceFolder: '/home/user/project',
    workspaceSourceLabel: 'active editor workspace',
    launchCwdLabel: '/home/user/project',
    launchCwd: '/home/user/project',
    launchCwdSourceLabel: 'workspace root',
    launchCommand: 'openclaude',
    terminalName: 'OpenClaude',
    profileStatusLabel: 'Found',
    profileStatusHint: '/home/user/project/.openclaude-profile.json',
    workspaceProfilePath: '/home/user/project/.openclaude-profile.json',
    canLaunchInWorkspaceRoot: true,
    workspaceRootCwdLabel: '/home/user/project',
  };
}

test('renderControlCenterHtml returns valid HTML with minimal status', () => {
  const html = renderControlCenterHtml(createMinimalStatus());
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.includes('</html>'));
});

test('renderControlCenterHtml includes the OpenClaude wordmark', () => {
  const html = renderControlCenterHtml(createMinimalStatus());
  assert.ok(html.includes('Open<span class="wordmark-accent">Claude</span>'));
});

test('renderControlCenterHtml CSP nonce matches script tag nonce', () => {
  const html = renderControlCenterHtml(createMinimalStatus());
  const cspNonce = html.match(/script-src 'nonce-([A-Za-z0-9+/=]+)'/);
  const scriptNonce = html.match(/<script nonce="([A-Za-z0-9+/=]+)">/);
  assert.ok(cspNonce && scriptNonce, 'both nonce locations must exist');
  assert.equal(cspNonce![1], scriptNonce![1]);
});

test('renderControlCenterHtml respects a caller-supplied nonce', () => {
  const html = renderControlCenterHtml(createMinimalStatus(), { nonce: 'test-nonce-123' });
  assert.ok(html.includes("'nonce-test-nonce-123'"));
  assert.ok(html.includes('nonce="test-nonce-123"'));
});

test('renderControlCenterHtml uses Ctrl+Shift+P for non-darwin platforms', () => {
  const html = renderControlCenterHtml(createMinimalStatus(), { platform: 'linux' });
  assert.ok(html.includes('Ctrl+Shift+P'));
});

test('renderControlCenterHtml uses Cmd+Shift+P for darwin', () => {
  const html = renderControlCenterHtml(createMinimalStatus(), { platform: 'darwin' });
  assert.ok(html.includes('Cmd+Shift+P'));
});

test('renderControlCenterHtml renders with an empty status object', () => {
  const html = renderControlCenterHtml({});
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('</html>'));
  assert.ok(html.includes('OpenClaude Control Center'));
});

// ---------------------------------------------------------------------------
// getRenderableViewModel branches via renderControlCenterHtml output
// ---------------------------------------------------------------------------

test('renderControlCenterHtml fills launchCwd detail from launchCwdSourceLabel when presentation omits it', () => {
  const status = createMinimalStatus();
  // presentation.ts does not set detail on the launchCwd summary card,
  // so getRenderableViewModel should fill it from launchCwdSourceLabel.
  const html = renderControlCenterHtml(status);
  assert.ok(html.includes('workspace root'), 'launchCwdSourceLabel should appear in the rendered output');
});

test('renderControlCenterHtml primary action shows active-file detail', () => {
  const status = {
    ...createMinimalStatus(),
    launchCwdSourceLabel: 'active file directory',
    launchCwdLabel: '/home/user/project/src',
    launchCwd: '/home/user/project/src',
  };
  const html = renderControlCenterHtml(status);
  assert.ok(html.includes('Starts beside the active file'));
});

test('renderControlCenterHtml primary action shows default cwd text when launchCwd is absent', () => {
  const status = {
    ...createMinimalStatus(),
    launchCwd: null,
    launchCwdLabel: undefined,
    launchCwdSourceLabel: undefined,
  };
  const html = renderControlCenterHtml(status);
  assert.ok(html.includes('Uses the VS Code default terminal cwd'));
});

test('renderControlCenterHtml workspace-root action shows shared-target reason', () => {
  const status = {
    ...createMinimalStatus(),
    launchActionsShareTargetReason: 'relative-launch-command',
  };
  const html = renderControlCenterHtml(status);
  assert.ok(html.includes('Same workspace-root target as Launch OpenClaude'));
});

// ---------------------------------------------------------------------------
// CSS — .sunset-gradient class
// ---------------------------------------------------------------------------

test('renderControlCenterHtml output includes the .sunset-gradient CSS class', () => {
  const html = renderControlCenterHtml(createMinimalStatus());
  assert.ok(html.includes('.sunset-gradient'));
});

// ---------------------------------------------------------------------------
// getToneClass — uncovered 'accent' branch
// ---------------------------------------------------------------------------

test('getToneClass returns tone-accent for accent tone', () => {
  assert.equal(getToneClass('accent'), 'tone-accent');
});
