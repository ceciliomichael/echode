export interface CustomProviderConfig {
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
  provider: string;
  model: string;
}

export interface AutocompleteSettings {
  enabled: boolean;
  provider: string;
  model: string;
  debounceMs: number;
  maxTokens: number;
  temperature: number;
}

export interface CommitMessageSettings {
  provider: string;
  model: string;
  customPrompt: string;
}

export interface ContextSettings {
  maxContextTokens: number;
}

export interface ApiSettings {
  provider: string;
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
  enabledTools?: unknown[];
  chatMode?: string;
  workspaceSettings?: Record<string, Partial<ApiSettings>>;
  indexingSettings?: IndexingSettings;
  autocompleteSettings?: AutocompleteSettings;
  contextSettings?: ContextSettings;
  commitMessageSettings?: CommitMessageSettings;
  customProviders?: CustomProviderConfig[];
}

export const DEFAULT_SETTINGS: ApiSettings = {
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