import type { ApiSettings, Provider } from '../../types/api-settings';

/**
 * Settings specific to a single provider
 */
export interface ProviderSettings {
  customUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  qwenCodeOauthPath?: string;
}

/**
 * State for a single provider
 */
export interface ProviderState {
  customUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

/**
 * Map of all provider states
 */
export interface ProviderStateMap {
  anthropic: ProviderState;
  openai: ProviderState;
  'openai-compatible': ProviderState;
  megallm: ProviderState;
  'vscode-lm': ProviderState;
  'qwen-code': ProviderState;
}

/**
 * Handler functions for updating provider settings
 */
export interface ProviderHandlers {
  handleCustomUrlChange: (value: string) => void;
  handleApiKeyChange: (value: string) => void;
  handleMaxTokensChange: (value: number) => void;
  handleTemperatureChange: (value: number) => void;
}

/**
 * Return type of useProviderSettings hook
 */
export interface UseProviderSettingsReturn {
  provider: Provider;
  currentSettings: ProviderSettings;
  model: string;
  setModel: (model: string) => void;
  handleProviderChange: (newProvider: Provider) => void;
  handleCustomUrlChange: (value: string) => void;
  handleMaxTokensChange: (value: number) => void;
  handleTemperatureChange: (value: number) => void;
  handleApiKeyChange: (value: string) => void;
  handleQwenCodeOauthPathChange: (value: string) => void;
  handleStreamingTimeoutChange: (value: number) => void;
  streamingTimeout: number;
  buildSettings: () => ApiSettings;
  allSettings: {
    anthropicCustomUrl: string;
    openaiCustomUrl: string;
    openaiCompatibleCustomUrl: string;
    anthropicModel: string;
    openaiModel: string;
    openaiCompatibleModel: string;
    vscodeLmModel: string;
    qwenCodeModel: string;
    anthropicApiKey: string;
    openaiApiKey: string;
    openaiCompatibleApiKey: string;
    qwenCodeOauthPath: string;
    anthropicMaxTokens: number;
    openaiMaxTokens: number;
    openaiCompatibleMaxTokens: number;
    vscodeLmMaxTokens: number;
    qwenCodeMaxTokens: number;
    anthropicTemperature: number;
    openaiTemperature: number;
    openaiCompatibleTemperature: number;
    vscodeLmTemperature: number;
    qwenCodeTemperature: number;
  };
}