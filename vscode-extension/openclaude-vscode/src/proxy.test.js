const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { mock } = require('bun:test');

// Mock vscode before loading proxy
mock.module('vscode', () => ({
  lm: {
    selectChatModels: async () => [],
    onDidChangeChatModels: () => ({ dispose() {} }),
  },
  CancellationTokenSource: class {
    token = { isCancellationRequested: false };
    cancel() {}
  },
  LanguageModelError: class extends Error {},
  LanguageModelTextPart: class {
    constructor(value) {
      this.value = value;
    }
  },
  LanguageModelToolCallPart: class {
    constructor(callId, name, input) {
      this.callId = callId;
      this.name = name;
      this.input = input;
    }
  },
  LanguageModelToolResultPart: class {
    constructor(id, parts) {
      this.callId = id;
      this.parts = parts;
    }
  },
  LanguageModelChatMessage: {
    User: (content) => ({ role: 'user', content }),
    Assistant: (content) => ({ role: 'assistant', content }),
  },
  LanguageModelChatTool: class {
    constructor(name, description, schema) {
      this.name = name;
      this.description = description;
      this.inputSchema = schema;
    }
  },
}));

const { _test } = require('./proxy');
const {
  normalizeModelName,
  pickModel,
  extractTextContent,
  estimateTokenCount,
  writeSSE,
  readBody,
  translateMessages,
  MAX_BODY_BYTES,
} = _test;

// ---------------------------------------------------------------------------
// normalizeModelName
// ---------------------------------------------------------------------------

test('normalizeModelName strips ANSI escape codes', () => {
  assert.equal(normalizeModelName('\x1b[1mclaude-opus\x1b[0m'), 'claude-opus');
});

test('normalizeModelName strips bracket suffixes', () => {
  assert.equal(normalizeModelName('claude-opus-4.6[1m]'), 'claude-opus-4.6');
});

test('normalizeModelName lowercases and trims', () => {
  assert.equal(normalizeModelName('  Claude-Sonnet  '), 'claude-sonnet');
});

test('normalizeModelName handles null/undefined gracefully', () => {
  assert.equal(normalizeModelName(null), '');
  assert.equal(normalizeModelName(undefined), '');
});

// ---------------------------------------------------------------------------
// pickModel
// ---------------------------------------------------------------------------

const fakeModels = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet', family: 'sonnet', vendor: 'copilot' },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus', family: 'opus', vendor: 'copilot' },
  { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku', family: 'haiku', vendor: 'copilot' },
];

test('pickModel returns null for empty model list', () => {
  assert.equal(pickModel([], 'claude-sonnet'), null);
});

test('pickModel returns first model when no model requested', () => {
  assert.equal(pickModel(fakeModels, null).id, 'claude-sonnet-4-20250514');
  assert.equal(pickModel(fakeModels, '').id, 'claude-sonnet-4-20250514');
});

test('pickModel matches exact id', () => {
  assert.equal(pickModel(fakeModels, 'claude-opus-4-20250514').id, 'claude-opus-4-20250514');
});

test('pickModel matches partial id', () => {
  assert.equal(pickModel(fakeModels, 'opus').id, 'claude-opus-4-20250514');
});

test('pickModel matches by family hint', () => {
  assert.equal(pickModel(fakeModels, 'haiku').id, 'claude-haiku-3-5-20241022');
});

test('pickModel strips ANSI and brackets from requested model', () => {
  assert.equal(pickModel(fakeModels, 'claude-opus-4[1m]').id, 'claude-opus-4-20250514');
});

test('pickModel falls back to first model for unknown request', () => {
  assert.equal(pickModel(fakeModels, 'gpt-99').id, 'claude-sonnet-4-20250514');
});

// ---------------------------------------------------------------------------
// extractTextContent
// ---------------------------------------------------------------------------

test('extractTextContent returns string content directly', () => {
  assert.equal(extractTextContent('hello world'), 'hello world');
});

test('extractTextContent joins text blocks from array', () => {
  const content = [
    { type: 'text', text: 'line 1' },
    { type: 'text', text: 'line 2' },
  ];
  assert.equal(extractTextContent(content), 'line 1\nline 2');
});

test('extractTextContent ignores non-text blocks', () => {
  const content = [
    { type: 'text', text: 'hello' },
    { type: 'image', source: {} },
    { type: 'tool_use', id: '1', name: 'test', input: {} },
  ];
  assert.equal(extractTextContent(content), 'hello');
});

test('extractTextContent returns empty string for non-string non-array', () => {
  assert.equal(extractTextContent(null), '');
  assert.equal(extractTextContent(42), '');
});

// ---------------------------------------------------------------------------
// estimateTokenCount
// ---------------------------------------------------------------------------

test('estimateTokenCount counts string system prompt', () => {
  const result = estimateTokenCount({ system: 'You are helpful.' });
  // 16 chars / 4 * 1.1 = 4.4 → ceil = 5
  assert.equal(result, 5);
});

test('estimateTokenCount counts array system prompt', () => {
  const result = estimateTokenCount({
    system: [{ text: 'block 1' }, { text: 'block 2' }],
  });
  // (7 + 7) = 14 / 4 * 1.1 = 3.85 → ceil = 4
  assert.equal(result, 4);
});

test('estimateTokenCount counts string message content', () => {
  const result = estimateTokenCount({
    messages: [{ role: 'user', content: 'Hello world!' }],
  });
  // 12 / 4 * 1.1 = 3.3 → ceil = 4
  assert.equal(result, 4);
});

test('estimateTokenCount counts tool_use blocks', () => {
  const result = estimateTokenCount({
    messages: [
      {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'bash', input: { cmd: 'ls' } }],
      },
    ],
  });
  // name: 4 chars + input JSON: '{"cmd":"ls"}' = 12 chars → 16 / 4 * 1.1 = 4.4 → 5
  assert.equal(result, 5);
});

test('estimateTokenCount counts tool_result blocks (string)', () => {
  const result = estimateTokenCount({
    messages: [
      {
        role: 'user',
        content: [{ type: 'tool_result', content: 'file.txt' }],
      },
    ],
  });
  // 8 / 4 * 1.1 = 2.2 → 3
  assert.equal(result, 3);
});

test('estimateTokenCount counts tool definitions', () => {
  const result = estimateTokenCount({
    tools: [
      {
        name: 'read',
        description: 'Read a file',
        input_schema: { type: 'object', properties: { path: { type: 'string' } } },
      },
    ],
  });
  const nameLen = 4;
  const descLen = 11;
  const schemaLen = JSON.stringify({ type: 'object', properties: { path: { type: 'string' } } }).length;
  const expected = Math.ceil(((nameLen + descLen + schemaLen) / 4) * 1.1);
  assert.equal(result, expected);
});

test('estimateTokenCount counts thinking blocks', () => {
  const result = estimateTokenCount({
    messages: [
      {
        role: 'assistant',
        content: [{ type: 'thinking', thinking: 'Let me consider...' }],
      },
    ],
  });
  // 18 / 4 * 1.1 = 4.95 → 5
  assert.equal(result, 5);
});

test('estimateTokenCount returns 0 for empty request', () => {
  assert.equal(estimateTokenCount({}), 0);
});

// ---------------------------------------------------------------------------
// writeSSE
// ---------------------------------------------------------------------------

test('writeSSE formats event and JSON data correctly', () => {
  let written = '';
  const fakeRes = {
    write: (data) => {
      written += data;
    },
  };

  writeSSE(fakeRes, 'message_start', { type: 'message_start', id: '123' });

  assert.equal(written, 'event: message_start\ndata: {"type":"message_start","id":"123"}\n\n');
});

// ---------------------------------------------------------------------------
// readBody
// ---------------------------------------------------------------------------

test('readBody reads a normal request body', async () => {
  const req = new EventEmitter();
  const promise = readBody(req);

  req.emit('data', 'hello ');
  req.emit('data', 'world');
  req.emit('end');

  assert.equal(await promise, 'hello world');
});

test('readBody rejects when request body exceeds MAX_BODY_BYTES', async () => {
  const req = new EventEmitter();
  req.destroy = () => {};
  const promise = readBody(req);

  // Send a chunk larger than 1MB
  const bigChunk = Buffer.alloc(MAX_BODY_BYTES + 1, 'x');
  req.emit('data', bigChunk);

  await assert.rejects(promise, { message: /exceeds/ });
});

test('readBody rejects on stream error', async () => {
  const req = new EventEmitter();
  const promise = readBody(req);

  req.emit('error', new Error('connection reset'));

  await assert.rejects(promise, { message: 'connection reset' });
});

// ---------------------------------------------------------------------------
// translateMessages
// ---------------------------------------------------------------------------

test('translateMessages converts string system prompt to User message', () => {
  const result = translateMessages([], 'You are helpful');
  assert.equal(result.length, 1);
  assert.equal(result[0].role, 'user');
  assert.equal(result[0].content, 'You are helpful');
});

test('translateMessages converts array system prompt to User message', () => {
  const result = translateMessages([], [{ text: 'Part 1' }, { text: 'Part 2' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].content, 'Part 1\nPart 2');
});

test('translateMessages converts user and assistant messages', () => {
  const messages = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there' },
  ];
  const result = translateMessages(messages, null);
  assert.equal(result.length, 2);
  assert.equal(result[0].role, 'user');
  assert.equal(result[0].content, 'Hello');
  assert.equal(result[1].role, 'assistant');
  assert.equal(result[1].content, 'Hi there');
});

test('translateMessages handles tool_result blocks in user messages', () => {
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Here is the result' },
        { type: 'tool_result', tool_use_id: 'toolu_123', content: 'output data' },
      ],
    },
  ];
  const result = translateMessages(messages, null);
  // Should have: 1 text User message + 1 tool_result User message
  assert.equal(result.length, 2);
  assert.equal(result[0].role, 'user');
  assert.equal(result[0].content, 'Here is the result');
});

test('translateMessages handles tool_use blocks in assistant messages', () => {
  const messages = [
    {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me check' },
        { type: 'tool_use', id: 'toolu_456', name: 'bash', input: { cmd: 'ls' } },
      ],
    },
  ];
  const result = translateMessages(messages, null);
  assert.equal(result.length, 2);
  assert.equal(result[0].role, 'assistant');
  assert.equal(result[0].content, 'Let me check');
  assert.equal(result[1].role, 'assistant');
});

// ---------------------------------------------------------------------------
// MAX_BODY_BYTES constant
// ---------------------------------------------------------------------------

test('MAX_BODY_BYTES is 1MB', () => {
  assert.equal(MAX_BODY_BYTES, 1024 * 1024);
});
