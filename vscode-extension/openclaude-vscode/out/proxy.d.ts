import * as http from 'http';
import * as vscode from 'vscode';
/** The object returned by startProxy(). */
export interface ProxyInstance {
  port: number;
  apiKey: string;
  server: http.Server;
  dispose: () => void;
}
/**
 * Anthropic API content block. Properties are optional because different
 * block types (text, tool_use, tool_result, thinking) carry different
 * fields, and the code accesses them defensively with `|| ''` guards.
 */
interface AnthropicContentBlock {
  type: string;
  /** text block */
  text?: string;
  /** tool_use block */
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  /** tool_result block */
  tool_use_id?: string;
  content?: string | AnthropicContentBlock[];
  /** thinking block */
  thinking?: string;
}
interface AnthropicSystemBlock {
  text: string;
}
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}
interface AnthropicToolDefinition {
  type?: string;
  name: string;
  description?: string;
  input_schema?: Record<string, unknown>;
}
/** Anthropic /v1/messages request body. */
export interface AnthropicMessagesRequest {
  model?: string;
  messages: AnthropicMessage[];
  system?: string | AnthropicSystemBlock[];
  max_tokens?: number;
  tools?: AnthropicToolDefinition[];
  stream?: boolean;
}
/**
 * Start the proxy server.
 */
export declare function startProxy(): Promise<ProxyInstance>;
/**
 * Normalize a model string: strip ANSI escape codes, brackets, and whitespace.
 * E.g. "claude-opus-4.6[1m]" → "claude-opus-4.6"
 */
declare function normalizeModelName(name: string): string;
/**
 * Pick the best model matching a requested model string.
 */
declare function pickModel(
  models: vscode.LanguageModelChat[],
  requestedModel: string | undefined,
): vscode.LanguageModelChat | null;
declare function translateMessages(
  messages: AnthropicMessage[],
  systemPrompt: string | AnthropicSystemBlock[] | undefined,
): vscode.LanguageModelChatMessage[];
declare function extractTextContent(content: string | AnthropicContentBlock[]): string;
/**
 * Estimate token count from an Anthropic messages request body.
 * Uses ~4 chars per token heuristic (same as the CLI's roughTokenCountEstimation).
 * This avoids the expensive fallback that makes a real messages.create call.
 */
declare function estimateTokenCount(request: AnthropicMessagesRequest): number;
declare function writeSSE(res: http.ServerResponse, event: string, data: unknown): void;
declare function readBody(req: http.IncomingMessage): Promise<string>;
export declare const _test: {
  normalizeModelName: typeof normalizeModelName;
  pickModel: typeof pickModel;
  extractTextContent: typeof extractTextContent;
  estimateTokenCount: typeof estimateTokenCount;
  writeSSE: typeof writeSSE;
  readBody: typeof readBody;
  translateMessages: typeof translateMessages;
  MAX_BODY_BYTES: number;
  CHARS_PER_TOKEN: number;
  TOKEN_OVERHEAD_MULTIPLIER: number;
};
//# sourceMappingURL=proxy.d.ts.map
