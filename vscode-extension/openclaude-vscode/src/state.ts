import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export type ProviderSource = 'profile' | 'env' | 'shim' | 'unknown';

export type EnvRecord = Record<string, string | undefined>;

export interface ProfileFile {
  profile: string;
  env: Record<string, string>;
  createdAt: string | null;
}

export interface LaunchWorkspace {
  workspacePath: string | null;
  source: 'active-workspace' | 'first-workspace' | 'none';
}

export interface LaunchWorkspaceInput {
  activeWorkspacePath?: string;
  workspacePaths?: string[];
}

export interface ProviderState {
  label: string;
  detail: string;
  source: ProviderSource;
}

export interface DescribeProviderInput {
  shimEnabled?: boolean;
  env: EnvRecord;
  profile?: ProfileFile | null;
}

export interface FindCommandOptions {
  cwd?: string;
  env?: EnvRecord;
  platform?: NodeJS.Platform;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OLLAMA_DEFAULT_PORT = '11434';
const LMSTUDIO_DEFAULT_PORT = '1234';

const SAVED_PROFILES: Set<string> = new Set(['openai', 'ollama', 'codex', 'gemini', 'atomic-chat']);

const CODEX_ALIAS_MODELS: Set<string> = new Set([
  'codexplan',
  'codexspark',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.3-codex',
  'gpt-5.3-codex-spark',
  'gpt-5.2',
  'gpt-5.2-codex',
  'gpt-5.1-codex-max',
  'gpt-5.1-codex-mini',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isEnvTruthy(value: unknown): boolean {
  const normalized = asNonEmptyString(value);
  if (!normalized) {
    return false;
  }

  const lowered = normalized.toLowerCase();
  return lowered !== '0' && lowered !== 'false' && lowered !== 'no';
}

function chooseLaunchWorkspace({ activeWorkspacePath, workspacePaths }: LaunchWorkspaceInput): LaunchWorkspace {
  const activePath = asNonEmptyString(activeWorkspacePath);
  if (activePath) {
    return { workspacePath: activePath, source: 'active-workspace' };
  }

  const firstWorkspacePath = Array.isArray(workspacePaths) ? asNonEmptyString(workspacePaths[0]) : null;

  if (firstWorkspacePath) {
    return { workspacePath: firstWorkspacePath, source: 'first-workspace' };
  }

  return { workspacePath: null, source: 'none' };
}

function sanitizeProfileEnv(env: unknown): Record<string, string> {
  if (!env || typeof env !== 'object' || Array.isArray(env)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(env as Record<string, unknown>).filter(([, value]) => typeof value === 'string' && value.trim()),
  ) as Record<string, string>;
}

function parseProfileFile(raw: string): ProfileFile | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const profile = asNonEmptyString(parsed.profile);
    if (!profile || !SAVED_PROFILES.has(profile)) {
      return null;
    }

    if (!parsed.env || typeof parsed.env !== 'object' || Array.isArray(parsed.env)) {
      return null;
    }

    return {
      profile,
      env: sanitizeProfileEnv(parsed.env),
      createdAt: asNonEmptyString(parsed.createdAt),
    };
  } catch (err: unknown) {
    console.debug('[openclaude] parseProfileFile failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

function isLocalBaseUrl(baseUrl: string | null): boolean {
  const normalized = asNonEmptyString(baseUrl);
  if (!normalized) {
    return false;
  }

  try {
    const hostname = new URL(normalized).hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.local')
    );
  } catch (err: unknown) {
    console.debug('[openclaude] isLocalBaseUrl parse failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

function getHostname(baseUrl: string | null): string | null {
  const normalized = asNonEmptyString(baseUrl);
  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).hostname.toLowerCase();
  } catch (err: unknown) {
    console.debug('[openclaude] getHostname parse failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

function resolveCommandCheckPath(command: string | null, workspacePath?: string | null): string | null {
  const normalized = asNonEmptyString(command);
  if (!normalized) {
    return null;
  }

  if (!normalized.includes(path.sep) && !normalized.includes('/')) {
    return null;
  }

  if (path.isAbsolute(normalized)) {
    return normalized;
  }

  return workspacePath ? path.resolve(workspacePath, normalized) : path.resolve(normalized);
}

function getEnvValue(env: EnvRecord, key: string): string {
  if (!env || typeof env !== 'object') {
    return '';
  }

  const matchedKey = Object.keys(env).find((candidate) => candidate.toUpperCase() === key);
  return matchedKey ? (env[matchedKey] ?? '') : '';
}

function canAccessExecutable(filePath: string, platform: NodeJS.Platform): boolean {
  try {
    fs.accessSync(filePath, platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findCommandPath(command: string | null, options: FindCommandOptions = {}): string | null {
  const normalized = asNonEmptyString(command);
  if (!normalized) {
    return null;
  }

  const cwd = asNonEmptyString(options.cwd);
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const hasPathSeparators = normalized.includes(path.sep) || normalized.includes('/');

  if (hasPathSeparators) {
    if (!path.isAbsolute(normalized) && !cwd) {
      return null;
    }

    const directPath = resolveCommandCheckPath(normalized, cwd);
    return directPath && canAccessExecutable(directPath, platform) ? directPath : null;
  }

  const pathValue = getEnvValue(env, 'PATH');
  if (!pathValue) {
    return null;
  }

  const pathExtValue = getEnvValue(env, 'PATHEXT');
  const hasExplicitExtension = Boolean(path.extname(normalized));
  const extensions =
    platform === 'win32'
      ? hasExplicitExtension
        ? ['']
        : (pathExtValue || '.COM;.EXE;.BAT;.CMD')
            .split(';')
            .map((extension) => extension.trim())
            .filter(Boolean)
      : [''];

  for (const directory of pathValue.split(path.delimiter)) {
    const baseDirectory = asNonEmptyString(directory);
    if (!baseDirectory) {
      continue;
    }

    for (const extension of extensions) {
      const candidatePath = path.join(baseDirectory, `${normalized}${extension}`);
      if (canAccessExecutable(candidatePath, platform)) {
        return candidatePath;
      }
    }
  }

  return null;
}

function isPathInsideWorkspace(filePath: string | null, workspacePath: string | null): boolean {
  const normalizedFilePath = asNonEmptyString(filePath);
  const normalizedWorkspacePath = asNonEmptyString(workspacePath);
  if (!normalizedFilePath || !normalizedWorkspacePath) {
    return false;
  }

  const resolvedFilePath = path.resolve(normalizedFilePath);
  const resolvedWorkspacePath = path.resolve(normalizedWorkspacePath);
  const comparableFilePath = process.platform === 'win32' ? resolvedFilePath.toLowerCase() : resolvedFilePath;
  const comparableWorkspacePath =
    process.platform === 'win32' ? resolvedWorkspacePath.toLowerCase() : resolvedWorkspacePath;
  const relativePath = path.relative(comparableWorkspacePath, comparableFilePath);

  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function hasCodexBaseUrl(baseUrl: string | null): boolean {
  const normalized = asNonEmptyString(baseUrl);
  if (!normalized) {
    return false;
  }

  return /chatgpt\.com\/backend-api\/codex/i.test(normalized);
}

function hasCodexAlias(model: string | null): boolean {
  const normalized = asNonEmptyString(model);
  if (!normalized) {
    return false;
  }

  const baseModel = normalized.toLowerCase().split('?', 1)[0] || normalized.toLowerCase();
  return CODEX_ALIAS_MODELS.has(baseModel);
}

function getOpenAICompatibleLabel(baseUrl: string | null, model: string | null): string {
  const normalizedBaseUrl = (asNonEmptyString(baseUrl) || '').toLowerCase();
  const normalizedModel = (asNonEmptyString(model) || '').toLowerCase();
  const hostname = getHostname(baseUrl);

  if (hasCodexBaseUrl(baseUrl) || (!baseUrl && hasCodexAlias(model))) {
    return 'Codex';
  }

  if (
    new RegExp(
      `localhost:${OLLAMA_DEFAULT_PORT}|127\\.0\\.0\\.1:${OLLAMA_DEFAULT_PORT}|0\\.0\\.0\\.0:${OLLAMA_DEFAULT_PORT}`,
      'i',
    ).test(normalizedBaseUrl)
  ) {
    return 'Ollama';
  }

  if (
    new RegExp(
      `localhost:${LMSTUDIO_DEFAULT_PORT}|127\\.0\\.0\\.1:${LMSTUDIO_DEFAULT_PORT}|0\\.0\\.0\\.0:${LMSTUDIO_DEFAULT_PORT}`,
      'i',
    ).test(normalizedBaseUrl)
  ) {
    return 'LM Studio';
  }

  if (normalizedBaseUrl.includes('deepseek') || normalizedModel.includes('deepseek')) {
    return 'DeepSeek';
  }

  if (normalizedBaseUrl.includes('openrouter')) {
    return 'OpenRouter';
  }

  if (normalizedBaseUrl.includes('together')) {
    return 'Together AI';
  }

  if (normalizedBaseUrl.includes('groq')) {
    return 'Groq';
  }

  if (normalizedBaseUrl.includes('mistral') || normalizedModel.includes('mistral')) {
    return 'Mistral';
  }

  if (normalizedBaseUrl.includes('azure')) {
    return 'Azure OpenAI';
  }

  if (hostname === 'api.openai.com' || !normalizedBaseUrl) {
    return 'OpenAI';
  }

  if (isLocalBaseUrl(normalizedBaseUrl)) {
    return 'Local OpenAI-compatible';
  }

  return 'OpenAI-compatible';
}

function buildProviderState(label: string, detail: string, source: ProviderSource): ProviderState {
  return {
    label,
    detail,
    source,
  };
}

function getDetail(env: EnvRecord, fallback: string): string {
  return (
    asNonEmptyString(env.OPENAI_MODEL) ||
    asNonEmptyString(env.GEMINI_MODEL) ||
    asNonEmptyString(env.OPENAI_BASE_URL) ||
    asNonEmptyString(env.GEMINI_BASE_URL) ||
    fallback
  );
}

function describeOpenAICompatible(env: EnvRecord, source: ProviderSource): ProviderState {
  const baseUrl = asNonEmptyString(env.OPENAI_BASE_URL) || asNonEmptyString(env.OPENAI_API_BASE);
  const model = asNonEmptyString(env.OPENAI_MODEL);
  const label = getOpenAICompatibleLabel(baseUrl, model);

  if (label === 'Codex') {
    return buildProviderState('Codex', model || 'ChatGPT Codex', source);
  }

  return buildProviderState(label, model || baseUrl || 'OpenAI-compatible runtime', source);
}

function describeSavedProfile(profile: ProfileFile): ProviderState {
  switch (profile.profile) {
    case 'ollama':
      return buildProviderState('Ollama', getDetail(profile.env, 'saved profile'), 'profile');
    case 'gemini':
      return buildProviderState('Gemini', getDetail(profile.env, 'saved profile'), 'profile');
    case 'codex':
      return buildProviderState('Codex', getDetail(profile.env, 'saved profile'), 'profile');
    case 'atomic-chat':
      return buildProviderState('Atomic Chat', getDetail(profile.env, 'saved profile'), 'profile');
    case 'openai':
    default:
      return describeOpenAICompatible(profile.env, 'profile');
  }
}

function describeProviderState({ shimEnabled, env, profile }: DescribeProviderInput): ProviderState {
  if (profile) {
    return describeSavedProfile(profile);
  }

  if (isEnvTruthy(env.CLAUDE_CODE_USE_GEMINI)) {
    return buildProviderState('Gemini', getDetail(env, 'from environment'), 'env');
  }

  if (isEnvTruthy(env.CLAUDE_CODE_USE_GITHUB)) {
    return buildProviderState('GitHub Models', getDetail(env, 'from environment'), 'env');
  }

  if (isEnvTruthy(env.CLAUDE_CODE_USE_BEDROCK)) {
    return buildProviderState('Bedrock', 'from environment', 'env');
  }

  if (isEnvTruthy(env.CLAUDE_CODE_USE_VERTEX)) {
    return buildProviderState('Vertex AI', 'from environment', 'env');
  }

  if (isEnvTruthy(env.CLAUDE_CODE_USE_FOUNDRY)) {
    return buildProviderState('Foundry', 'from environment', 'env');
  }

  if (isEnvTruthy(env.CLAUDE_CODE_USE_OPENAI)) {
    return describeOpenAICompatible(env, 'env');
  }

  if (shimEnabled) {
    return buildProviderState('OpenAI-compatible (provider unknown)', 'launch shim enabled', 'shim');
  }

  return buildProviderState('Unknown', 'no saved profile or provider env detected', 'unknown');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export {
  chooseLaunchWorkspace,
  describeProviderState,
  findCommandPath,
  isPathInsideWorkspace,
  parseProfileFile,
  resolveCommandCheckPath,
};
