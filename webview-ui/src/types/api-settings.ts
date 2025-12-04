export type Provider = 'anthropic' | 'openai' | 'openai-compatible' | 'megallm' | 'vscode-lm' | 'qwen-code';

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

export interface ContextSettings {
  enabled: boolean;
  maxContextTokens: number;
  thresholdPercent: number;
  provider: Provider;
  model: string;
}

export const DEFAULT_CONTEXT_SETTINGS: ContextSettings = {
  enabled: false,
  maxContextTokens: 128000,
  thresholdPercent: 70,
  provider: 'anthropic',
  model: '',
};

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
  systemPrompt?: string;
  enabledTools?: Tool[];
  chatMode?: 'agent' | 'plan' | 'ask' | 'general';
  indexingSettings?: IndexingSettings;
  autocompleteSettings?: AutocompleteSettings;
  contextSettings?: ContextSettings;
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
 * Safely get provider defaults with fallback to anthropic
 */
export function getProviderDefaults(provider: Provider | undefined) {
  if (!provider || !(provider in PROVIDER_DEFAULTS)) {
    return PROVIDER_DEFAULTS.anthropic;
  }
  return PROVIDER_DEFAULTS[provider];
}