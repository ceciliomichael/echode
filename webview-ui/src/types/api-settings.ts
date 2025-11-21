export type Provider = 'anthropic' | 'openai' | 'openai-compatible';

export interface ApiSettings {
  provider: Provider;
  customBaseUrl?: string;
  anthropicCustomUrl?: string;
  openaiCustomUrl?: string;
  openaiCompatibleCustomUrl?: string;
  apiKey: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  openaiCompatibleApiKey?: string;
  model: string;
  anthropicModel?: string;
  openaiModel?: string;
  openaiCompatibleModel?: string;
  anthropicMaxTokens: number;
  openaiMaxTokens: number;
  openaiCompatibleMaxTokens: number;
  anthropicTemperature: number;
  openaiTemperature: number;
  openaiCompatibleTemperature: number;
  systemPrompt?: string;
}

export const DEFAULT_API_SETTINGS: ApiSettings = {
  provider: 'anthropic',
  customBaseUrl: '',
  anthropicCustomUrl: '',
  openaiCustomUrl: '',
  openaiCompatibleCustomUrl: '',
  apiKey: '',
  anthropicApiKey: '',
  openaiApiKey: '',
  openaiCompatibleApiKey: '',
  model: '',
  anthropicMaxTokens: 8192,
  openaiMaxTokens: 4096,
  openaiCompatibleMaxTokens: 4096,
  anthropicTemperature: 0.0,
  openaiTemperature: 0.0,
  openaiCompatibleTemperature: 0.0,
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