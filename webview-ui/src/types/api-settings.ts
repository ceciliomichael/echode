export type Provider = 'anthropic' | 'openai' | 'openai-compatible';

export interface ApiSettings {
  provider: Provider;
  customBaseUrl?: string;
  anthropicCustomUrl?: string;
  openaiCustomUrl?: string;
  openaiCompatibleCustomUrl?: string;
  apiKey: string;
  model: string;
  anthropicModel?: string;
  openaiModel?: string;
  openaiCompatibleModel?: string;
  anthropicMaxTokens: number;
  openaiMaxTokens: number;
  openaiCompatibleMaxTokens: number;
  systemPrompt?: string;
}

export const DEFAULT_API_SETTINGS: ApiSettings = {
  provider: 'anthropic',
  customBaseUrl: '',
  anthropicCustomUrl: '',
  openaiCustomUrl: '',
  openaiCompatibleCustomUrl: '',
  apiKey: '',
  model: '',
  anthropicMaxTokens: 8192,
  openaiMaxTokens: 4096,
  openaiCompatibleMaxTokens: 4096,
  systemPrompt: '',
};

export const PROVIDER_DEFAULTS = {
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    maxTokens: 8192,
  },
  openai: {
    baseUrl: 'https://api.openai.com',
    maxTokens: 4096,
  },
  'openai-compatible': {
    baseUrl: 'http://localhost:1234',
    maxTokens: 4096,
  },
} as const;