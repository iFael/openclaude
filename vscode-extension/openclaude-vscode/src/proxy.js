// proxy.js — Anthropic-compatible HTTP proxy backed by VS Code Language Model API.
//
// Creates a local HTTP server that accepts requests in the Anthropic
// /v1/messages format and translates them to vscode.lm calls. Streams
// responses back as Anthropic SSE events.

const http = require('http');
const crypto = require('crypto');
const vscode = require('vscode');

/**
 * @typedef {Object} ProxyInstance
 * @property {number} port
 * @property {string} apiKey
 * @property {http.Server} server
 * @property {() => void} dispose
 */

/**
 * Start the proxy server.
 * @returns {Promise<ProxyInstance>}
 */
async function startProxy() {
  const apiKey = `oc-lm-${crypto.randomUUID()}`;
  let activeModels = await selectClaudeModels();

  // Re-discover models when they change
  const modelChangeDisposable = vscode.lm.onDidChangeChatModels(async () => {
    activeModels = await selectClaudeModels();
  });

  const server = http.createServer(async (req, res) => {
    // --- Health check ---
    if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Hello from OpenClaudeProxy');
      return;
    }

    // --- Model diagnostics (no auth required) ---
    if (req.method === 'GET' && req.url === '/v1/models') {
      const models = activeModels.map(m => ({
        id: m.id,
        name: m.name || m.id,
        vendor: m.vendor || 'unknown',
        family: m.family || 'unknown',
        version: m.version || 'unknown',
        maxInputTokens: m.maxInputTokens || 0,
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models, count: models.length }));
      return;
    }

    // --- Auth check ---
    const incomingKey =
      req.headers['x-api-key'] ||
      (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (incomingKey !== apiKey) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        type: 'error',
        error: { type: 'authentication_error', message: 'Invalid API key' },
      }));
      return;
    }

    // --- POST /v1/messages ---
    if (req.method === 'POST' && req.url === '/v1/messages') {
      try {
        const body = await readBody(req);
        const request = JSON.parse(body);
        await handleMessages(request, activeModels, res);
      } catch (err) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({
          type: 'error',
          error: { type: 'api_error', message: String(err?.message || err) },
        }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      type: 'error',
      error: { type: 'not_found_error', message: `Not found: ${req.method} ${req.url}` },
    }));
  });

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const port = /** @type {import('net').AddressInfo} */ (server.address()).port;
      resolve({
        port,
        apiKey,
        server,
        dispose() {
          modelChangeDisposable.dispose();
          server.close();
        },
      });
    });
    server.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Model discovery
// ---------------------------------------------------------------------------

async function selectClaudeModels() {
  try {
    // Try multiple selectors — the model registration varies by extension
    const allModels = await vscode.lm.selectChatModels();
    // Prefer Claude models
    const claude = allModels.filter(
      m => /claude/i.test(m.id) || /claude/i.test(m.name || '') || /claude/i.test(m.family || ''),
    );
    return claude.length > 0 ? claude : allModels;
  } catch {
    return [];
  }
}

/**
 * Normalize a model string: strip ANSI escape codes, brackets, and whitespace.
 * E.g. "claude-opus-4.6[1m]" → "claude-opus-4.6"
 */
function normalizeModelName(name) {
  return (name || '')
    // Strip ANSI escape sequences (e.g. \x1b[1m)
    .replace(/\x1b\[[0-9;]*m/g, '')
    // Strip leftover bracket suffixes like [1m]
    .replace(/\[[^\]]*\]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Pick the best model matching a requested model string.
 */
function pickModel(models, requestedModel) {
  if (!models.length) return null;
  if (!requestedModel) return models[0];

  const lower = normalizeModelName(requestedModel);

  // Exact id match
  const exact = models.find(m => normalizeModelName(m.id) === lower);
  if (exact) return exact;

  // Partial match on id, name, or family
  const partial = models.find(
    m =>
      normalizeModelName(m.id).includes(lower) ||
      normalizeModelName(m.name).includes(lower) ||
      normalizeModelName(m.family).includes(lower),
  );
  if (partial) return partial;

  // Family heuristics: sonnet → sonnet, opus → opus, haiku → haiku
  for (const hint of ['opus', 'sonnet', 'haiku']) {
    if (lower.includes(hint)) {
      const match = models.find(
        m =>
          normalizeModelName(m.id).includes(hint) ||
          normalizeModelName(m.name).includes(hint) ||
          normalizeModelName(m.family).includes(hint),
      );
      if (match) return match;
    }
  }

  // Fallback to first Claude model, then first model overall
  const claude = models.find(m => /claude/i.test(m.id) || /claude/i.test(m.name || ''));
  return claude || models[0];
}

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

async function handleMessages(request, models, res) {
  const model = pickModel(models, request.model);
  if (!model) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      type: 'error',
      error: { type: 'api_error', message: 'No language models available. Is GitHub Copilot active?' },
    }));
    return;
  }

  // Build LM API messages
  const lmMessages = translateMessages(request.messages, request.system);

  // Build options
  const options = {};
  if (request.max_tokens) {
    options.maxTokens = request.max_tokens;
  }

  // Translate tools if present (client-side tools only)
  if (request.tools && request.tools.length > 0) {
    const clientTools = request.tools
      .filter(t => t.type !== 'web_search_20250305') // skip server-side tools
      .map(t => {
        if (t.input_schema) {
          return new vscode.LanguageModelChatTool(
            t.name,
            t.description || '',
            t.input_schema,
          );
        }
        return null;
      })
      .filter(Boolean);
    if (clientTools.length > 0) {
      options.tools = clientTools;
    }
  }

  // Send request with cancellation support
  const cts = new vscode.CancellationTokenSource();
  req_on_close(res, () => cts.cancel());

  let response;
  try {
    response = await model.sendRequest(lmMessages, options, cts.token);
  } catch (err) {
    // Handle consent dialog or other LM API errors
    if (err instanceof vscode.LanguageModelError) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        type: 'error',
        error: { type: 'api_error', message: `Language Model error: ${err.message}` },
      }));
      return;
    }
    throw err;
  }

  // --- Stream SSE response ---
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const msgId = `msg_${crypto.randomBytes(12).toString('hex')}`;

  // message_start
  writeSSE(res, 'message_start', {
    type: 'message_start',
    message: {
      id: msgId,
      type: 'message',
      role: 'assistant',
      model: model.id,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
  });

  let contentIndex = 0;
  let outputTokenEstimate = 0;
  let currentBlockType = null;
  let lastBlockType = null;

  try {
    for await (const part of response.stream) {
      if (cts.token.isCancellationRequested) break;

      if (part instanceof vscode.LanguageModelTextPart) {
        // Start text block if not already in one
        if (currentBlockType !== 'text') {
          if (currentBlockType !== null) {
            writeSSE(res, 'content_block_stop', { type: 'content_block_stop', index: contentIndex });
            contentIndex++;
          }
          currentBlockType = 'text';
          writeSSE(res, 'content_block_start', {
            type: 'content_block_start',
            index: contentIndex,
            content_block: { type: 'text', text: '' },
          });
        }

        writeSSE(res, 'content_block_delta', {
          type: 'content_block_delta',
          index: contentIndex,
          delta: { type: 'text_delta', text: part.value },
        });
        outputTokenEstimate += Math.ceil(part.value.length / 4);
      } else if (part instanceof vscode.LanguageModelToolCallPart) {
        // Close any open text block
        if (currentBlockType !== null) {
          writeSSE(res, 'content_block_stop', { type: 'content_block_stop', index: contentIndex });
          contentIndex++;
        }
        currentBlockType = 'tool_use';

        const toolInput = typeof part.input === 'string'
          ? JSON.parse(part.input)
          : (part.input || {});

        writeSSE(res, 'content_block_start', {
          type: 'content_block_start',
          index: contentIndex,
          content_block: {
            type: 'tool_use',
            id: part.callId || `toolu_${crypto.randomBytes(12).toString('hex')}`,
            name: part.name,
            input: toolInput,
          },
        });

        // For tool_use, the full input is in content_block_start.
        // Send an empty delta for protocol compliance.
        writeSSE(res, 'content_block_delta', {
          type: 'content_block_delta',
          index: contentIndex,
          delta: { type: 'input_json_delta', partial_json: '' },
        });

        writeSSE(res, 'content_block_stop', { type: 'content_block_stop', index: contentIndex });
        contentIndex++;
        lastBlockType = 'tool_use';
        currentBlockType = null;
      }
      // LanguageModelToolResultPart is handled in messages, not responses
    }
  } catch (streamErr) {
    // If the stream errors, we still need to close the SSE properly
    if (currentBlockType !== null) {
      writeSSE(res, 'content_block_stop', { type: 'content_block_stop', index: contentIndex });
    }
    writeSSE(res, 'message_delta', {
      type: 'message_delta',
      delta: { stop_reason: 'error', stop_sequence: null },
      usage: { input_tokens: 0, output_tokens: outputTokenEstimate },
    });
    writeSSE(res, 'message_stop', { type: 'message_stop' });
    res.end('\ndata: [DONE]\n\n');
    return;
  }

  // Close final content block
  if (currentBlockType !== null) {
    writeSSE(res, 'content_block_stop', { type: 'content_block_stop', index: contentIndex });
  }

  // Determine stop reason
  const finalType = currentBlockType || lastBlockType;
  const stopReason = finalType === 'tool_use' ? 'tool_use' : 'end_turn';

  // message_delta with usage
  writeSSE(res, 'message_delta', {
    type: 'message_delta',
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: {
      input_tokens: 0,
      output_tokens: outputTokenEstimate,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  });

  writeSSE(res, 'message_stop', { type: 'message_stop' });
  res.end('\ndata: [DONE]\n\n');
}

// ---------------------------------------------------------------------------
// Message translation: Anthropic → VS Code LM API
// ---------------------------------------------------------------------------

function translateMessages(messages, systemPrompt) {
  const lmMessages = [];

  // System prompt as a User message prefix (LM API convention)
  if (systemPrompt) {
    const text = typeof systemPrompt === 'string'
      ? systemPrompt
      : systemPrompt.map(b => b.text || '').join('\n');
    if (text) {
      lmMessages.push(vscode.LanguageModelChatMessage.User(text));
    }
  }

  for (const msg of messages) {
    if (msg.role === 'user') {
      const text = extractTextContent(msg.content);
      if (text) {
        lmMessages.push(vscode.LanguageModelChatMessage.User(text));
      }

      // Also handle tool_result blocks in user messages
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'tool_result') {
            const resultText = typeof block.content === 'string'
              ? block.content
              : (block.content || []).map(b => b.text || '').join('\n');
            lmMessages.push(
              vscode.LanguageModelChatMessage.User(
                new vscode.LanguageModelToolResultPart(block.tool_use_id, [
                  new vscode.LanguageModelTextPart(resultText),
                ]),
              ),
            );
          }
        }
      }
    } else if (msg.role === 'assistant') {
      const text = extractTextContent(msg.content);
      if (text) {
        lmMessages.push(vscode.LanguageModelChatMessage.Assistant(text));
      }

      // Handle tool_use blocks in assistant messages
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'tool_use') {
            lmMessages.push(
              vscode.LanguageModelChatMessage.Assistant([
                new vscode.LanguageModelToolCallPart(
                  block.id,
                  block.name,
                  block.input || {},
                ),
              ]),
            );
          }
        }
      }
    }
  }

  return lmMessages;
}

function extractTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');
  }
  return '';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function req_on_close(res, fn) {
  res.on('close', fn);
}

module.exports = { startProxy };
