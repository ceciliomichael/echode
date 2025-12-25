import type { ApiSettings, Provider, CustomProvider, ReasoningEffort } from '../../types/api-settings';

/**
 * Settings specific to a single provider
 */
export interface ProviderSettings {
  customUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  reasoningEffort?: ReasoningEffort;
  qwenCodeOauthPath?: string;
  zaiThinking?: boolean;
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
  reasoningEffort?: ReasoningEffort;
  zaiThinking?: boolean;
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
  zai: ProviderState;
}

/**
 * Custom provider handlers
 */
export interface CustomProviderHandlers {
  handleAddCustomProvider: (provider: CustomProvider) => void;
  handleUpdateCustomProvider: (provider: CustomProvider) => void;
  handleDeleteCustomProvider: (id: string) => void;
}

/**
 * Handler functions for updating provider settings
 */
export interface ProviderHandlers {
  handleCustomUrlChange: (value: string) => void;
  handleApiKeyChange: (value: string) => void;
  handleMaxTokensChange: (value: number) => void;
  handleTemperatureChange: (value: number) => void;
  handleReasoningEffortChange: (value: ReasoningEffort | undefined) => void;
  handleZaiThinkingChange: (value: boolean) => void;
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
  handleReasoningEffortChange: (value: ReasoningEffort | undefined) => void;
  handleZaiThinkingChange: (value: boolean) => void;
  handleQwenCodeOauthPathChange: (value: string) => void;
  handleStreamingTimeoutChange: (value: number) => void;
  streamingTimeout: number;
  buildSettings: () => ApiSettings;
  // Custom providers
  customProviders: CustomProvider[];
  handleAddCustomProvider: (provider: CustomProvider) => void;
  handleUpdateCustomProvider: (provider: CustomProvider) => void;
  handleDeleteCustomProvider: (id: string) => void;
  allSettings: {
    anthropicCustomUrl: string;
    openaiCustomUrl: string;
    openaiCompatibleCustomUrl: string;
    zaiCustomUrl: string;
    anthropicModel: string;
    openaiModel: string;
    openaiCompatibleModel: string;
    vscodeLmModel: string;
    qwenCodeModel: string;
    zaiModel: string;
    anthropicApiKey: string;
    openaiApiKey: string;
    openaiCompatibleApiKey: string;
    zaiApiKey: string;
    openaiCompatibleReasoningEffort?: ReasoningEffort;
    megallmReasoningEffort?: ReasoningEffort;
    qwenCodeOauthPath: string;
    anthropicMaxTokens: number;
    openaiMaxTokens: number;
    openaiCompatibleMaxTokens: number;
    vscodeLmMaxTokens: number;
    qwenCodeMaxTokens: number;
    zaiMaxTokens: number;
    anthropicTemperature: number;
    openaiTemperature: number;
    openaiCompatibleTemperature: number;
    vscodeLmTemperature: number;
    qwenCodeTemperature: number;
    zaiTemperature: number;
    zaiThinking: boolean;
  };
}