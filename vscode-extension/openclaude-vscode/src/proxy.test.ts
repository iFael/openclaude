// proxy-coverage.test.ts
//
// Coverage-focused companion to proxy.test.ts.  Imports proxy.ts WITHOUT a
// cache-buster so bun's coverage tool properly attributes executed lines.

import { mock, test } from 'bun:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

// ---------------------------------------------------------------------------
// Mock classes — shared between mock.module and test assertions so that
// `instanceof` checks inside proxy.ts resolve correctly.
// ---------------------------------------------------------------------------

class MockTextPart {
  constructor(public value: string) {}
}

class MockToolCallPart {
  constructor(
    public callId: string,
    public name: string,
    public input: unknown,
  ) {}
}

class MockToolResultPart {
  constructor(
    public callId: string,
    public parts: unknown[],
  ) {}
}

class MockLMError extends Error {}

class MockCancellationTokenSource {
  token = { isCancellationRequested: false };
  cancel() {
    this.token.isCancellationRequested = true;
  }
}

class MockChatTool {
  constructor(
    public name: string,
    public description: string,
    public inputSchema: unknown,
  ) {
    if (name === '__throw__') throw new Error('ctor error');
  }
}

// Mutable state used by the mock — set before each integration test.
let mockModelList: any[] = [];
let selectChatModelsFn: () => Promise<any[]> = async () => mockModelList;
let modelChangeCallback: ((...args: any[]) => any) | null = null;

mock.restore();
mock.module('vscode', () => ({
  lm: {
    selectChatModels: (..._a: any[]) => selectChatModelsFn(),
    onDidChangeChatModels: (cb: (...args: any[]) => any) => {
      modelChangeCallback = cb;
      return {
        dispose() {
          modelChangeCallback = null;
        },
      };
    },
  },
  CancellationTokenSource: MockCancellationTokenSource,
  LanguageModelError: MockLMError,
  LanguageModelTextPart: MockTextPart,
  LanguageModelToolCallPart: MockToolCallPart,
  LanguageModelToolResultPart: MockToolResultPart,
  LanguageModelChatMessage: {
    User: (content: unknown) => ({ role: 'user', content }),
    Assistant: (content: unknown) => ({ role: 'assistant', content }),
  },
  LanguageModelChatTool: MockChatTool,
}));

// Import WITHOUT cache buster so bun tracks coverage for proxy.ts
const { _test, startProxy } = await import('./proxy');
const {
  normalizeModelName,
  pickModel,
  extractTextContent,
  estimateTokenCount,
  writeSSE,
  readBody,
  translateMessages,
  MAX_BODY_BYTES,
  CHARS_PER_TOKEN,
  TOKEN_OVERHEAD_MULTIPLIER,
} = _test;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function createMockModel(overrides: Record<string, unknown> = {}) {
  return {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet',
    family: 'sonnet',
    vendor: 'copilot',
    maxInputTokens: 200000,
    version: '4',
    sendRequest: async () => ({
      stream: (async function* () {
        yield new MockTextPart('Hello');
        yield new MockTextPart(' world');
      })(),
    }),
    ...overrides,
  };
}

// =========================================================================
// normalizeModelName
// =========================================================================

test('cov: normalizeModelName strips ANSI codes', () => {
  assert.equal(normalizeModelName('\x1b[1mclaude\x1b[0m'), 'claude');
});

test('cov: normalizeModelName strips bracket suffixes', () => {
  assert.equal(normalizeModelName('model[1m]'), 'model');
});

test('cov: normalizeModelName handles null/undefined', () => {
  assert.equal(normalizeModelName(null as any), '');
  assert.equal(normalizeModelName(undefined as any), '');
});

test('cov: normalizeModelName trims and lowercases', () => {
  assert.equal(normalizeModelName('  FOO  '), 'foo');
});

test('cov: normalizeModelName handles empty string', () => {
  assert.equal(normalizeModelName(''), '');
});

// =========================================================================
// pickModel
// =========================================================================

const testModels = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet', family: 'sonnet', vendor: 'copilot' },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus', family: 'opus', vendor: 'copilot' },
  { id: 'claude-haiku-3-5', name: 'Claude Haiku', family: 'haiku', vendor: 'copilot' },
] as any[];

test('cov: pickModel null for empty list', () => {
  assert.equal(pickModel([], 'anything'), null);
});

test('cov: pickModel first when null/undefined/empty', () => {
  assert.equal(pickModel(testModels, null as any)!.id, 'claude-sonnet-4-20250514');
  assert.equal(pickModel(testModels, undefined as any)!.id, 'claude-sonnet-4-20250514');
  assert.equal(pickModel(testModels, '')!.id, 'claude-sonnet-4-20250514');
});

test('cov: pickModel exact id match', () => {
  assert.equal(pickModel(testModels, 'claude-opus-4-20250514')!.id, 'claude-opus-4-20250514');
});

test('cov: pickModel partial match', () => {
  assert.equal(pickModel(testModels, 'opus')!.id, 'claude-opus-4-20250514');
});

test('cov: pickModel family hints', () => {
  assert.equal(pickModel(testModels, 'some-haiku')!.id, 'claude-haiku-3-5');
  assert.equal(pickModel(testModels, 'my-sonnet')!.id, 'claude-sonnet-4-20250514');
  assert.equal(pickModel(testModels, 'use-opus')!.id, 'claude-opus-4-20250514');
});

test('cov: pickModel fallback for unknown model', () => {
  assert.equal(pickModel(testModels, 'gpt-99-xyz')!.id, 'claude-sonnet-4-20250514');
});

test('cov: pickModel strips ANSI from requested', () => {
  assert.equal(pickModel(testModels, 'claude-opus-4\x1b[1m')!.id, 'claude-opus-4-20250514');
});

// =========================================================================
// extractTextContent
// =========================================================================

test('cov: extractTextContent string passthrough', () => {
  assert.equal(extractTextContent('hello'), 'hello');
});

test('cov: extractTextContent joins text blocks', () => {
  assert.equal(
    extractTextContent([
      { type: 'text', text: 'a' },
      { type: 'text', text: 'b' },
    ]),
    'a\nb',
  );
});

test('cov: extractTextContent filters non-text', () => {
  assert.equal(
    extractTextContent([
      { type: 'text', text: 'keep' },
      { type: 'image', source: {} },
    ]),
    'keep',
  );
});

test('cov: extractTextContent empty for null', () => {
  assert.equal(extractTextContent(null as any), '');
});

// =========================================================================
// estimateTokenCount
// =========================================================================

test('cov: estimateTokenCount string system', () => {
  assert.equal(estimateTokenCount({ system: 'Hello world!' } as any), 4);
});

test('cov: estimateTokenCount array system', () => {
  const r = estimateTokenCount({ system: [{ text: 'hi' }, { text: 'there' }] } as any);
  assert.equal(r, Math.ceil(((2 + 5) / CHARS_PER_TOKEN) * TOKEN_OVERHEAD_MULTIPLIER));
});

test('cov: estimateTokenCount string message', () => {
  const r = estimateTokenCount({ messages: [{ role: 'user', content: 'test' }] } as any);
  assert.equal(r, Math.ceil((4 / CHARS_PER_TOKEN) * TOKEN_OVERHEAD_MULTIPLIER));
});

test('cov: estimateTokenCount tool_use block', () => {
  const input = { path: '/a' };
  const r = estimateTokenCount({
    messages: [{ role: 'assistant', content: [{ type: 'tool_use', name: 'read', input }] }],
  } as any);
  const chars = 4 + JSON.stringify(input).length;
  assert.equal(r, Math.ceil((chars / CHARS_PER_TOKEN) * TOKEN_OVERHEAD_MULTIPLIER));
});

test('cov: estimateTokenCount tool_result string', () => {
  const r = estimateTokenCount({
    messages: [{ role: 'user', content: [{ type: 'tool_result', content: 'output' }] }],
  } as any);
  assert.equal(r, Math.ceil((6 / CHARS_PER_TOKEN) * TOKEN_OVERHEAD_MULTIPLIER));
});

test('cov: estimateTokenCount tool_result array content', () => {
  const r = estimateTokenCount({
    messages: [{ role: 'user', content: [{ type: 'tool_result', content: [{ text: 'aa' }, { text: 'bb' }] }] }],
  } as any);
  assert.equal(r, Math.ceil((4 / CHARS_PER_TOKEN) * TOKEN_OVERHEAD_MULTIPLIER));
});

test('cov: estimateTokenCount thinking block', () => {
  const r = estimateTokenCount({
    messages: [{ role: 'assistant', content: [{ type: 'thinking', thinking: 'hmm...' }] }],
  } as any);
  assert.equal(r, Math.ceil((6 / CHARS_PER_TOKEN) * TOKEN_OVERHEAD_MULTIPLIER));
});

test('cov: estimateTokenCount tool definitions', () => {
  const schema = { type: 'object', properties: {} };
  const r = estimateTokenCount({
    tools: [{ name: 'bash', description: 'Run commands', input_schema: schema }],
  } as any);
  const chars = 4 + 12 + JSON.stringify(schema).length;
  assert.equal(r, Math.ceil((chars / CHARS_PER_TOKEN) * TOKEN_OVERHEAD_MULTIPLIER));
});

test('cov: estimateTokenCount empty request', () => {
  assert.equal(estimateTokenCount({} as any), 0);
});

// =========================================================================
// writeSSE
// =========================================================================

test('cov: writeSSE formats correctly', () => {
  let out = '';
  const fakeRes = {
    write: (s: string) => {
      out += s;
    },
  };
  writeSSE(fakeRes as any, 'evt', { x: 1 });
  assert.equal(out, 'event: evt\ndata: {"x":1}\n\n');
});

// =========================================================================
// readBody
// =========================================================================

test('cov: readBody normal', async () => {
  const req = new EventEmitter();
  const p = readBody(req as any);
  req.emit('data', Buffer.from('abc'));
  req.emit('end');
  assert.equal(await p, 'abc');
});

test('cov: readBody oversized', async () => {
  const req = new EventEmitter() as any;
  req.destroy = () => {};
  const p = readBody(req);
  req.emit('data', Buffer.alloc(MAX_BODY_BYTES + 1));
  await assert.rejects(p, { message: /exceeds/ });
});

test('cov: readBody error', async () => {
  const req = new EventEmitter();
  const p = readBody(req as any);
  req.emit('error', new Error('fail'));
  await assert.rejects(p, { message: 'fail' });
});

// =========================================================================
// translateMessages
// =========================================================================

test('cov: translateMessages string system prompt', () => {
  const r = translateMessages([], 'Be helpful');
  assert.equal(r.length, 1);
  assert.equal(r[0].role, 'user');
  assert.equal(r[0].content, 'Be helpful');
});

test('cov: translateMessages array system prompt', () => {
  const r = translateMessages([], [{ text: 'A' }, { text: 'B' }]);
  assert.equal(r[0].content, 'A\nB');
});

test('cov: translateMessages no system prompt', () => {
  assert.equal(translateMessages([], undefined).length, 0);
});

test('cov: translateMessages user and assistant', () => {
  const r = translateMessages(
    [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hey' },
    ],
    undefined,
  );
  assert.equal(r.length, 2);
  assert.equal(r[0].role, 'user');
  assert.equal(r[1].role, 'assistant');
});

test('cov: translateMessages tool_use in assistant', () => {
  const r = translateMessages(
    [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'checking' },
          { type: 'tool_use', id: 't1', name: 'read', input: { path: '/x' } },
        ],
      },
    ],
    undefined,
  );
  assert.equal(r.length, 2);
  assert.equal(r[0].role, 'assistant');
  assert.equal(r[1].role, 'assistant');
});

test('cov: translateMessages tool_result in user (string)', () => {
  const r = translateMessages(
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'result:' },
          { type: 'tool_result', tool_use_id: 't1', content: 'data' },
        ],
      },
    ],
    undefined,
  );
  assert.equal(r.length, 2);
});

test('cov: translateMessages tool_result array content', () => {
  const r = translateMessages(
    [
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 't2', content: [{ text: 'l1' }, { text: 'l2' }] }],
      },
    ],
    undefined,
  );
  assert.equal(r.length, 1);
});

test('cov: translateMessages tool_result undefined content', () => {
  const r = translateMessages([{ role: 'user', content: [{ type: 'tool_result', tool_use_id: 't3' }] }], undefined);
  assert.equal(r.length, 1);
});

// =========================================================================
// Constants
// =========================================================================

test('cov: MAX_BODY_BYTES is 1 MB', () => {
  assert.equal(MAX_BODY_BYTES, 1024 * 1024);
});

test('cov: CHARS_PER_TOKEN is 4', () => {
  assert.equal(CHARS_PER_TOKEN, 4);
});

test('cov: TOKEN_OVERHEAD_MULTIPLIER is 1.1', () => {
  assert.equal(TOKEN_OVERHEAD_MULTIPLIER, 1.1);
});

// =========================================================================
// Integration: HTTP routes via startProxy()
// =========================================================================

test('cov: GET / health check', async () => {
  mockModelList = [];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/`);
    assert.equal(res.status, 200);
    assert.ok((await res.text()).includes('OpenClaudeProxy'));
  } finally {
    p.dispose();
  }
});

test('cov: GET /v1/models', async () => {
  mockModelList = [createMockModel()];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/models`, {
      headers: { 'x-api-key': p.apiKey },
    });
    const json = (await res.json()) as any;
    assert.equal(json.count, 1);
    assert.equal(json.models[0].id, 'claude-sonnet-4-20250514');
  } finally {
    p.dispose();
  }
});

test('cov: POST without auth returns 401', async () => {
  mockModelList = [createMockModel()];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(res.status, 401);
    const json = (await res.json()) as any;
    assert.equal(json.error.type, 'authentication_error');
  } finally {
    p.dispose();
  }
});

test('cov: auth via Authorization Bearer', async () => {
  mockModelList = [createMockModel()];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${p.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'claude-sonnet', messages: [{ role: 'user', content: 'hi' }] }),
    });
    assert.equal(res.status, 200);
  } finally {
    p.dispose();
  }
});

test('cov: unknown route 404', async () => {
  mockModelList = [];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/unknown`, {
      method: 'POST',
      headers: { 'x-api-key': p.apiKey },
    });
    assert.equal(res.status, 404);
    const json = (await res.json()) as any;
    assert.equal(json.error.type, 'not_found_error');
  } finally {
    p.dispose();
  }
});

test('cov: POST /v1/messages/count_tokens', async () => {
  mockModelList = [createMockModel()];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/messages/count_tokens`, {
      method: 'POST',
      headers: { 'x-api-key': p.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello world test' }] }),
    });
    assert.equal(res.status, 200);
    const json = (await res.json()) as any;
    assert.ok(json.input_tokens > 0);
  } finally {
    p.dispose();
  }
});

test('cov: count_tokens invalid JSON returns 500', async () => {
  mockModelList = [];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/messages/count_tokens`, {
      method: 'POST',
      headers: { 'x-api-key': p.apiKey, 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    assert.equal(res.status, 500);
  } finally {
    p.dispose();
  }
});

test('cov: POST /v1/messages streams text', async () => {
  mockModelList = [createMockModel()];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': p.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.ok(body.includes('event: message_start'));
    assert.ok(body.includes('Hello'));
    assert.ok(body.includes(' world'));
    assert.ok(body.includes('event: message_stop'));
    assert.ok(body.includes('[DONE]'));
    assert.ok(body.includes('"stop_reason":"end_turn"'));
  } finally {
    p.dispose();
  }
});

test('cov: POST /v1/messages with tool_use in stream', async () => {
  mockModelList = [
    createMockModel({
      sendRequest: async () => ({
        stream: (async function* () {
          yield new MockTextPart('Let me check');
          yield new MockToolCallPart('toolu_123', 'bash', { cmd: 'ls' });
        })(),
      }),
    }),
  ];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': p.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet',
        messages: [{ role: 'user', content: 'list files' }],
      }),
    });
    const body = await res.text();
    assert.ok(body.includes('"type":"tool_use"'));
    assert.ok(body.includes('"stop_reason":"tool_use"'));
  } finally {
    p.dispose();
  }
});

test('cov: POST /v1/messages tool input as string', async () => {
  mockModelList = [
    createMockModel({
      sendRequest: async () => ({
        stream: (async function* () {
          yield new MockToolCallPart('toolu_s', 'read', '{"path":"/tmp"}');
        })(),
      }),
    }),
  ];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': p.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet', messages: [{ role: 'user', content: 'go' }] }),
    });
    const body = await res.text();
    assert.ok(body.includes('"path":"/tmp"'));
  } finally {
    p.dispose();
  }
});

test('cov: POST /v1/messages tool null input falls back to {}', async () => {
  mockModelList = [
    createMockModel({
      sendRequest: async () => ({
        stream: (async function* () {
          yield new MockToolCallPart('toolu_n', 'noop', null);
        })(),
      }),
    }),
  ];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': p.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet', messages: [{ role: 'user', content: 'go' }] }),
    });
    const body = await res.text();
    assert.ok(body.includes('"input":{}'));
  } finally {
    p.dispose();
  }
});

test('cov: POST /v1/messages empty callId generates toolu_ id', async () => {
  mockModelList = [
    createMockModel({
      sendRequest: async () => ({
        stream: (async function* () {
          yield new MockToolCallPart('', 'test_tool', {});
        })(),
      }),
    }),
  ];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': p.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet', messages: [{ role: 'user', content: 'go' }] }),
    });
    const body = await res.text();
    assert.ok(body.includes('toolu_'));
  } finally {
    p.dispose();
  }
});

test('cov: POST /v1/messages no models returns 503', async () => {
  mockModelList = [];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': p.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });
    assert.equal(res.status, 503);
    const json = (await res.json()) as any;
    assert.ok(json.error.message.includes('No language models'));
  } finally {
    p.dispose();
  }
});

test('cov: POST /v1/messages LanguageModelError returns 400', async () => {
  mockModelList = [
    createMockModel({
      sendRequest: async () => {
        throw new MockLMError('Consent required');
      },
    }),
  ];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': p.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet', messages: [{ role: 'user', content: 'hi' }] }),
    });
    assert.equal(res.status, 400);
    const json = (await res.json()) as any;
    assert.ok(json.error.message.includes('Language Model error'));
  } finally {
    p.dispose();
  }
});

test('cov: POST /v1/messages generic error returns 500', async () => {
  mockModelList = [
    createMockModel({
      sendRequest: async () => {
        throw new Error('kaboom');
      },
    }),
  ];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': p.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet', messages: [{ role: 'user', content: 'hi' }] }),
    });
    assert.equal(res.status, 500);
  } finally {
    p.dispose();
  }
});

test('cov: stream error after text closes SSE gracefully', async () => {
  mockModelList = [
    createMockModel({
      sendRequest: async () => ({
        stream: (async function* () {
          yield new MockTextPart('partial');
          throw new Error('stream broke');
        })(),
      }),
    }),
  ];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': p.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet', messages: [{ role: 'user', content: 'hi' }] }),
    });
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.ok(body.includes('event: message_stop'));
    assert.ok(body.includes('"stop_reason":"error"'));
    assert.ok(body.includes('[DONE]'));
  } finally {
    p.dispose();
  }
});

test('cov: stream error with no parts emitted', async () => {
  mockModelList = [
    createMockModel({
      sendRequest: async () => ({
        stream: (async function* () {
          yield; // satisfy generator contract before throwing
          throw new Error('immediate');
        })(),
      }),
    }),
  ];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': p.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet', messages: [{ role: 'user', content: 'hi' }] }),
    });
    const body = await res.text();
    assert.ok(body.includes('"stop_reason":"error"'));
    assert.ok(body.includes('event: message_stop'));
  } finally {
    p.dispose();
  }
});

test('cov: POST /v1/messages with tools (filter + constructor)', async () => {
  mockModelList = [createMockModel()];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': p.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet',
        messages: [{ role: 'user', content: 'help' }],
        tools: [
          { name: 'bash', description: 'Run shell', input_schema: { type: 'object' } },
          { type: 'web_search_20250305', name: 'web_search' },
          { name: 'no_schema' },
        ],
      }),
    });
    assert.equal(res.status, 200);
  } finally {
    p.dispose();
  }
});

test('cov: POST /v1/messages with system prompt and max_tokens', async () => {
  mockModelList = [createMockModel()];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': p.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet',
        system: 'You are helpful.',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 100,
      }),
    });
    assert.equal(res.status, 200);
  } finally {
    p.dispose();
  }
});

test('cov: URL query strings are stripped from pathname', async () => {
  mockModelList = [createMockModel()];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/messages?beta=true`, {
      method: 'POST',
      headers: { 'x-api-key': p.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet', messages: [{ role: 'user', content: 'test' }] }),
    });
    assert.equal(res.status, 200);
  } finally {
    p.dispose();
  }
});

// =========================================================================
// Integration: selectClaudeModels edge cases
// =========================================================================

test('cov: selectClaudeModels catches errors and returns empty', async () => {
  const orig = selectChatModelsFn;
  selectChatModelsFn = async () => {
    throw new Error('API unavailable');
  };
  try {
    const p = await startProxy();
    try {
      const res = await fetch(`http://127.0.0.1:${p.port}/v1/models`, {
        headers: { 'x-api-key': p.apiKey },
      });
      const json = (await res.json()) as any;
      assert.equal(json.count, 0);
    } finally {
      p.dispose();
    }
  } finally {
    selectChatModelsFn = orig;
  }
});

test('cov: selectClaudeModels returns all when no Claude models', async () => {
  mockModelList = [
    { id: 'gpt-4', name: 'GPT-4', family: 'gpt', vendor: 'openai', maxInputTokens: 100000, version: '4' },
  ];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/models`, {
      headers: { 'x-api-key': p.apiKey },
    });
    const json = (await res.json()) as any;
    assert.equal(json.count, 1);
    assert.equal(json.models[0].id, 'gpt-4');
  } finally {
    p.dispose();
  }
});

test('cov: selectClaudeModels filters Claude models from mixed set', async () => {
  mockModelList = [
    { id: 'gpt-4', name: 'GPT-4', family: 'gpt', vendor: 'openai', maxInputTokens: 100000, version: '4' },
    {
      id: 'claude-sonnet-4',
      name: 'Sonnet',
      family: 'sonnet',
      vendor: 'copilot',
      maxInputTokens: 200000,
      version: '4',
    },
  ];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/models`, {
      headers: { 'x-api-key': p.apiKey },
    });
    const json = (await res.json()) as any;
    assert.equal(json.count, 1);
    assert.equal(json.models[0].id, 'claude-sonnet-4');
  } finally {
    p.dispose();
  }
});

test('cov: onDidChangeChatModels callback re-discovers models', async () => {
  mockModelList = [createMockModel()];
  const p = await startProxy();
  try {
    // The callback was captured by the mock — invoke it to cover line 89-90
    assert.ok(modelChangeCallback, 'callback should have been captured');
    await modelChangeCallback!();
    // Verify the proxy still serves the models after re-discovery
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/models`, {
      headers: { 'x-api-key': p.apiKey },
    });
    const json = (await res.json()) as any;
    assert.equal(json.count, 1);
  } finally {
    p.dispose();
  }
});

test('cov: ToolCtor catch branch when constructor throws', async () => {
  mockModelList = [createMockModel()];
  const p = await startProxy();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': p.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet',
        messages: [{ role: 'user', content: 'go' }],
        tools: [{ name: '__throw__', description: 'will throw', input_schema: { type: 'object' } }],
      }),
    });
    // The tool should be silently skipped (catch returns null, filtered by Boolean)
    assert.equal(res.status, 200);
  } finally {
    p.dispose();
  }
});
