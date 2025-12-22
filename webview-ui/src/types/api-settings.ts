import type { ChatMode } from './chat-mode';

export type BuiltInProvider = 'anthropic' | 'openai' | 'openai-compatible' | 'megallm' | 'vscode-lm' | 'qwen-code';

// Extended provider type that includes custom providers with pattern custom-{id}
export type Provider = BuiltInProvider | `custom-${string}`;

/**
 * Per-mode model configuration
 * Each chat mode can have its own provider and model
 */
export interface ModeModelSettings {
  provider: Provider;
  model: string;
}

/**
 * Configuration for a custom OpenAI-compatible provider
 */
export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface IndexingSettings {
  enabled: boolean;
  provider: Provider;
  model: string;
}

export const DEFAULT_INDEXING_SETTINGS: IndexingSettings = {
  enabled: true,
  provider: 'anthropic',
  model: '',
};

export interface AutocompleteSettings {
  enabled: boolean;
  provider: Provider;
  model: string;
  debounceMs: number;
  maxTokens: number;
  temperature: number;
}

export const DEFAULT_AUTOCOMPLETE_SETTINGS: AutocompleteSettings = {
  enabled: false,
  provider: 'openai-compatible',
  model: '',
  debounceMs: 150,
  maxTokens: 128,
  temperature: 0.2,
};

export interface CommitMessageSettings {
  provider: Provider;
  model: string;
  customPrompt: string;
}

export const DEFAULT_COMMIT_MESSAGE_SETTINGS: CommitMessageSettings = {
  provider: 'anthropic',
  model: '',
  customPrompt: '',
};

export interface ContextSettings {
  maxContextTokens: number;
}

export const DEFAULT_CONTEXT_SETTINGS: ContextSettings = {
  maxContextTokens: 128000,
};

/**
 * Per-workspace MCP server overrides
 * Allows enabling/disabling specific MCP servers per workspace
 */
export interface McpServerOverride {
  enabled: boolean;
}

export type McpServerOverrides = Record<string, McpServerOverride>;

// ChatMode is imported from './chat-mode' - re-export for convenience
export type { ChatMode } from './chat-mode';

export interface Tool {
  id: string;
  name: string;
  description: string;
  aiDescription?: string;
  enabled: boolean;
}

export interface ApiSettings {
  provider: Provider;
  customBaseUrl?: string;
  anthropicCustomUrl?: string;
  openaiCustomUrl?: string;
  openaiCompatibleCustomUrl?: string;
  megallmCustomUrl?: string;
  apiKey: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  openaiCompatibleApiKey?: string;
  megallmApiKey?: string;
  qwenCodeOauthPath?: string;
  model: string;
  anthropicModel?: string;
  openaiModel?: string;
  openaiCompatibleModel?: string;
  megallmModel?: string;
  vscodeLmModel?: string;
  qwenCodeModel?: string;
  anthropicMaxTokens: number;
  openaiMaxTokens: number;
  openaiCompatibleMaxTokens: number;
  megallmMaxTokens: number;
  vscodeLmMaxTokens: number;
  qwenCodeMaxTokens: number;
  anthropicTemperature: number;
  openaiTemperature: number;
  openaiCompatibleTemperature: number;
  megallmTemperature: number;
  vscodeLmTemperature: number;
  qwenCodeTemperature: number;
  streamingTimeout: number;
  systemPrompt?: string;
  enabledTools?: Tool[];
  chatMode?: 'agent' | 'plan' | 'ask' | 'general' | 'chat' | 'review';
  workspaceSettings?: Record<string, Partial<ApiSettings>>;
  indexingSettings?: IndexingSettings;
  autocompleteSettings?: AutocompleteSettings;
  contextSettings?: ContextSettings;
  commitMessageSettings?: CommitMessageSettings;
  customProviders?: CustomProvider[];
  /** Per-mode model configuration - each mode can have its own provider/model */
  modeModelSettings?: Partial<Record<ChatMode, ModeModelSettings>>;
  /** Per-workspace MCP server overrides */
  mcpServerOverrides?: McpServerOverrides;
}

export const DEFAULT_API_SETTINGS: ApiSettings = {
  provider: 'anthropic',
  customBaseUrl: '',
  anthropicCustomUrl: '',
  openaiCustomUrl: '',
  openaiCompatibleCustomUrl: '',
  megallmCustomUrl: '',
  apiKey: '',
  anthropicApiKey: '',
  openaiApiKey: '',
  openaiCompatibleApiKey: '',
  megallmApiKey: '',
  qwenCodeOauthPath: '',
  model: '',
  anthropicMaxTokens: 8192,
  openaiMaxTokens: 4096,
  openaiCompatibleMaxTokens: 4096,
  megallmMaxTokens: 4096,
  vscodeLmMaxTokens: 4096,
  qwenCodeMaxTokens: 65536,
  anthropicTemperature: 0.0,
  openaiTemperature: 0.0,
  openaiCompatibleTemperature: 0.0,
  megallmTemperature: 0.0,
  vscodeLmTemperature: 1.0,
  qwenCodeTemperature: 0.0,
  streamingTimeout: 5000,
  systemPrompt: '',
};

export const PROVIDER_DEFAULTS = {
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    maxTokens: 8192,
    temperature: 1.0,
  },
  openai: {
    baseUrl: 'https://api.openai.com',
    maxTokens: 4096,
    temperature: 1.0,
  },
  'openai-compatible': {
    baseUrl: 'http://localhost:1234',
    maxTokens: 4096,
    temperature: 1.0,
  },
  megallm: {
    baseUrl: 'https://ai.megallm.io',
    maxTokens: 4096,
    temperature: 1.0,
  },
  'vscode-lm': {
    baseUrl: '',
    maxTokens: 4096,
    temperature: 1.0,
  },
  'qwen-code': {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    maxTokens: 65536,
    temperature: 0.0,
  },
} as const;

/**
 * Check if a provider is a built-in provider
 */
export function isBuiltInProvider(provider: string): provider is BuiltInProvider {
  return provider in PROVIDER_DEFAULTS;
}

/**
 * Check if a provider is a custom provider
 */
export function isCustomProvider(provider: string): boolean {
  return provider.startsWith('custom-');
}

/**
 * Safely get provider defaults with fallback to openai-compatible for custom providers
 */
export function getProviderDefaults(provider: Provider | undefined) {
  if (!provider) {
    return PROVIDER_DEFAULTS.anthropic;
  }
  // Custom providers use openai-compatible defaults
  if (isCustomProvider(provider)) {
    return PROVIDER_DEFAULTS['openai-compatible'];
  }
  if (isBuiltInProvider(provider)) {
    return PROVIDER_DEFAULTS[provider];
  }
  return PROVIDER_DEFAULTS.anthropic;
}