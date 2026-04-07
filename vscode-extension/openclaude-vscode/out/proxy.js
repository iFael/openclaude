"use strict";
// proxy.ts — Anthropic-compatible HTTP proxy backed by VS Code Language Model API.
//
// Creates a local HTTP server that accepts requests in the Anthropic
// /v1/messages format and translates them to vscode.lm calls. Streams
// responses back as Anthropic SSE events.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports._test = void 0;
exports.startProxy = startProxy;
const crypto = __importStar(require("crypto"));
const http = __importStar(require("http"));
const vscode = __importStar(require("vscode"));
const security_1 = require("./security");
// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
/**
 * Start the proxy server.
 */
async function startProxy() {
    const apiKey = `oc-lm-${crypto.randomUUID()}`;
    let activeModels = await selectClaudeModels();
    // Re-discover models when they change
    const modelChangeDisposable = vscode.lm.onDidChangeChatModels(async () => {
        activeModels = await selectClaudeModels();
    });
    const server = http.createServer(async (req, res) => {
        // Parse pathname once, stripping query strings (e.g. ?beta=true)
        const pathname = (req.url || '').split('?')[0];
        // --- DNS rebinding protection ---
        if (!(0, security_1.isValidHostHeader)(req.headers.host)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                type: 'error',
                error: { type: 'forbidden', message: 'Invalid Host header' },
            }));
            return;
        }
        // --- Health check ---
        if (req.method === 'GET' && (pathname === '/' || pathname === '')) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Hello from OpenClaudeProxy');
            return;
        }
        // --- Auth check ---
        const incomingKey = req.headers['x-api-key'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        if (!incomingKey || !(0, security_1.timingSafeEqual)(incomingKey, apiKey)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                type: 'error',
                error: { type: 'authentication_error', message: 'Invalid API key' },
            }));
            return;
        }
        // --- Model listing (authenticated) ---
        if (req.method === 'GET' && pathname === '/v1/models') {
            const models = activeModels.map((m) => ({
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
        // --- POST /v1/messages/count_tokens ---
        // The Anthropic SDK calls this endpoint to count tokens. Instead of
        // letting it 404 (which triggers an expensive fallback that makes a
        // real messages.create call with max_tokens:1), return a local estimate.
        // This saves 1-3 premium requests per turn.
        if (req.method === 'POST' && pathname === '/v1/messages/count_tokens') {
            try {
                const body = await readBody(req);
                const request = JSON.parse(body);
                const estimate = estimateTokenCount(request);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ input_tokens: estimate }));
            }
            catch (err) {
                console.debug('[openclaude-proxy] count_tokens error:', err?.message || err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    type: 'error',
                    error: { type: 'api_error', message: 'Internal proxy error during token counting' },
                }));
            }
            return;
        }
        // --- POST /v1/messages ---
        if (req.method === 'POST' && pathname === '/v1/messages') {
            try {
                const body = await readBody(req);
                const request = JSON.parse(body);
                await handleMessages(request, activeModels, res);
            }
            catch (err) {
                console.debug('[openclaude-proxy] messages error:', err?.message || err);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                }
                res.end(JSON.stringify({
                    type: 'error',
                    error: { type: 'api_error', message: 'Internal proxy error during message handling' },
                }));
            }
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            type: 'error',
            error: { type: 'not_found_error', message: `Not found: ${req.method} ${pathname}` },
        }));
    });
    return new Promise((resolve, reject) => {
        server.maxConnections = 10;
        server.headersTimeout = 10000;
        server.requestTimeout = 30000;
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
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
        const claude = allModels.filter((m) => /claude/i.test(m.id) || /claude/i.test(m.name || '') || /claude/i.test(m.family || ''));
        return claude.length > 0 ? claude : allModels;
    }
    catch (err) {
        console.debug('[openclaude-proxy] selectClaudeModels failed:', err?.message || err);
        return [];
    }
}
/**
 * Normalize a model string: strip ANSI escape codes, brackets, and whitespace.
 * E.g. "claude-opus-4.6[1m]" → "claude-opus-4.6"
 */
function normalizeModelName(name) {
    return ((name || '')
        // Strip ANSI escape sequences (e.g. \x1b[1m)
        .replace(/\x1b\[[0-9;]*m/g, '')
        // Strip leftover bracket suffixes like [1m]
        .replace(/\[[^\]]*\]/g, '')
        .trim()
        .toLowerCase());
}
/**
 * Pick the best model matching a requested model string.
 */
function pickModel(models, requestedModel) {
    if (!models.length)
        return null;
    if (!requestedModel)
        return models[0];
    const lower = normalizeModelName(requestedModel);
    // Exact id match
    const exact = models.find((m) => normalizeModelName(m.id) === lower);
    if (exact)
        return exact;
    // Partial match on id, name, or family
    const partial = models.find((m) => normalizeModelName(m.id).includes(lower) ||
        normalizeModelName(m.name).includes(lower) ||
        normalizeModelName(m.family).includes(lower));
    if (partial)
        return partial;
    // Family heuristics: sonnet → sonnet, opus → opus, haiku → haiku
    for (const hint of ['opus', 'sonnet', 'haiku']) {
        if (lower.includes(hint)) {
            const match = models.find((m) => normalizeModelName(m.id).includes(hint) ||
                normalizeModelName(m.name).includes(hint) ||
                normalizeModelName(m.family).includes(hint));
            if (match)
                return match;
        }
    }
    // Fallback to first Claude model, then first model overall
    const claude = models.find((m) => /claude/i.test(m.id) || /claude/i.test(m.name || ''));
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
        // vscode.lm tool support depends on the VS Code version and the LM
        // provider. Build tool descriptors using the available constructor;
        // if none exists, skip tools entirely — the model will still respond,
        // just without tool_use blocks.
        //
        // These constructors may not be present in all VS Code versions or in
        // @types/vscode — access dynamically with type assertions.
        const ToolCtor = vscode.LanguageModelChatTool ?? vscode.LanguageModelToolInformation;
        if (ToolCtor) {
            const clientTools = request.tools
                .filter((t) => t.type !== 'web_search_20250305') // skip server-side tools
                .map((t) => {
                if (t.input_schema) {
                    try {
                        return new ToolCtor(t.name, t.description || '', t.input_schema);
                    }
                    catch {
                        return null;
                    }
                }
                return null;
            })
                .filter(Boolean);
            if (clientTools.length > 0) {
                options.tools = clientTools;
            }
        }
    }
    // Send request with cancellation support
    const cts = new vscode.CancellationTokenSource();
    onRequestClose(res, () => cts.cancel());
    let response;
    try {
        response = await model.sendRequest(lmMessages, options, cts.token);
    }
    catch (err) {
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
        Connection: 'keep-alive',
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
            if (cts.token.isCancellationRequested)
                break;
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
                outputTokenEstimate += Math.ceil(part.value.length / CHARS_PER_TOKEN);
            }
            else if (part instanceof vscode.LanguageModelToolCallPart) {
                // Close any open text block
                if (currentBlockType !== null) {
                    writeSSE(res, 'content_block_stop', { type: 'content_block_stop', index: contentIndex });
                    contentIndex++;
                }
                currentBlockType = 'tool_use';
                // input may arrive as a string (older providers) or as an object
                const rawInput = part.input;
                const toolInput = typeof rawInput === 'string' ? JSON.parse(rawInput) : rawInput || {};
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
    }
    catch (streamErr) {
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
            : systemPrompt.map((b) => b.text || '').join('\n');
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
                            : (block.content || [])
                                .map((b) => b.text || '')
                                .join('\n');
                        // The User() factory may not accept a single ToolResultPart in all
                        // @types/vscode versions — use a type assertion for compatibility.
                        lmMessages.push(vscode.LanguageModelChatMessage.User(new vscode.LanguageModelToolResultPart(block.tool_use_id, [
                            new vscode.LanguageModelTextPart(resultText),
                        ])));
                    }
                }
            }
        }
        else if (msg.role === 'assistant') {
            const text = extractTextContent(msg.content);
            if (text) {
                lmMessages.push(vscode.LanguageModelChatMessage.Assistant(text));
            }
            // Handle tool_use blocks in assistant messages
            if (Array.isArray(msg.content)) {
                for (const block of msg.content) {
                    if (block.type === 'tool_use') {
                        // The Assistant() factory's accepted content types may vary across
                        // VS Code versions — use a type assertion for compatibility.
                        lmMessages.push(vscode.LanguageModelChatMessage.Assistant([
                            new vscode.LanguageModelToolCallPart(block.id, block.name, block.input || {}),
                        ]));
                    }
                }
            }
        }
    }
    return lmMessages;
}
function extractTextContent(content) {
    if (typeof content === 'string')
        return content;
    if (Array.isArray(content)) {
        return content
            .filter((b) => b.type === 'text')
            .map((b) => b.text)
            .join('\n');
    }
    return '';
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * Estimate token count from an Anthropic messages request body.
 * Uses ~4 chars per token heuristic (same as the CLI's roughTokenCountEstimation).
 * This avoids the expensive fallback that makes a real messages.create call.
 */
function estimateTokenCount(request) {
    let chars = 0;
    // System prompt
    if (request.system) {
        if (typeof request.system === 'string') {
            chars += request.system.length;
        }
        else if (Array.isArray(request.system)) {
            for (const block of request.system) {
                chars += (block.text || '').length;
            }
        }
    }
    // Messages
    if (Array.isArray(request.messages)) {
        for (const msg of request.messages) {
            if (typeof msg.content === 'string') {
                chars += msg.content.length;
            }
            else if (Array.isArray(msg.content)) {
                for (const block of msg.content) {
                    if (block.type === 'text') {
                        chars += (block.text || '').length;
                    }
                    else if (block.type === 'tool_use') {
                        chars += JSON.stringify(block.input || {}).length;
                        chars += (block.name || '').length;
                    }
                    else if (block.type === 'tool_result') {
                        if (typeof block.content === 'string') {
                            chars += block.content.length;
                        }
                        else if (Array.isArray(block.content)) {
                            for (const sub of block.content) {
                                chars += (sub.text || '').length;
                            }
                        }
                    }
                    else if (block.type === 'thinking') {
                        chars += (block.thinking || '').length;
                    }
                }
            }
        }
    }
    // Tools definitions
    if (Array.isArray(request.tools)) {
        for (const tool of request.tools) {
            chars += (tool.name || '').length;
            chars += (tool.description || '').length;
            chars += JSON.stringify(tool.input_schema || {}).length;
        }
    }
    // ~CHARS_PER_TOKEN chars per token, add overhead for message framing
    return Math.ceil((chars / CHARS_PER_TOKEN) * TOKEN_OVERHEAD_MULTIPLIER);
}
function writeSSE(res, event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB — generous for any Anthropic messages payload.
const CHARS_PER_TOKEN = 4;
const TOKEN_OVERHEAD_MULTIPLIER = 1.1;
const REQUEST_BODY_TIMEOUT_MS = 30000;
function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        let bytes = 0;
        const timer = setTimeout(() => {
            req.destroy();
            reject(new Error('Request body timeout'));
        }, REQUEST_BODY_TIMEOUT_MS);
        req.on('data', (chunk) => {
            bytes += chunk.length;
            if (bytes > MAX_BODY_BYTES) {
                clearTimeout(timer);
                req.destroy();
                reject(new Error(`Request body exceeds ${MAX_BODY_BYTES} bytes`));
                return;
            }
            body += chunk;
        });
        req.on('end', () => {
            clearTimeout(timer);
            resolve(body);
        });
        req.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}
function onRequestClose(res, fn) {
    res.on('close', fn);
}
// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
// Exported for testing only:
exports._test = {
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
};
//# sourceMappingURL=proxy.js.map