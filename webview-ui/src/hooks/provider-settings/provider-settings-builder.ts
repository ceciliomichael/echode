import type { ApiSettings, Provider } from '../../types/api-settings';
import type { ProviderStateMap, ProviderSettings } from './types';
import { storageService } from '../../utils/storage';

/**
 * Build complete ApiSettings object from provider states
 * This is a pure function with no side effects
 */
export function buildApiSettings(
  provider: Provider,
  providerStates: ProviderStateMap,
  currentSettings: ProviderSettings,
  qwenCodeOauthPath: string,
  streamingTimeout: number
): ApiSettings {
  const persisted = storageService.getSettings();

  return {
    provider,
    customBaseUrl: currentSettings.customUrl,
    anthropicCustomUrl: providerStates.anthropic.customUrl,
    openaiCustomUrl: providerStates.openai.customUrl,
    openaiCompatibleCustomUrl: providerStates['openai-compatible'].customUrl,
    // Preserve existing model selection; settings page does not manage models
    model: persisted.model,
    anthropicModel: persisted.anthropicModel,
    openaiModel: persisted.openaiModel,
    openaiCompatibleModel: persisted.openaiCompatibleModel,
    vscodeLmModel: persisted.vscodeLmModel,
    qwenCodeModel: persisted.qwenCodeModel,
    // Generic apiKey mirrors active provider-specific key (VS Code LM uses empty string)
    apiKey: currentSettings.apiKey,
    anthropicApiKey: providerStates.anthropic.apiKey,
    openaiApiKey: providerStates.openai.apiKey,
    openaiCompatibleApiKey: providerStates['openai-compatible'].apiKey,
    openaiCompatibleReasoningEffort: providerStates['openai-compatible'].reasoningEffort,
    megallmReasoningEffort: providerStates.megallm.reasoningEffort,
    megallmApiKey: providerStates.megallm.apiKey,
    qwenCodeOauthPath,
    anthropicMaxTokens: providerStates.anthropic.maxTokens,
    openaiMaxTokens: providerStates.openai.maxTokens,
    openaiCompatibleMaxTokens: providerStates['openai-compatible'].maxTokens,
    megallmMaxTokens: providerStates.megallm.maxTokens,
    vscodeLmMaxTokens: providerStates['vscode-lm'].maxTokens,
    qwenCodeMaxTokens: providerStates['qwen-code'].maxTokens,
    anthropicTemperature: providerStates.anthropic.temperature,
    openaiTemperature: providerStates.openai.temperature,
    openaiCompatibleTemperature: providerStates['openai-compatible'].temperature,
    megallmTemperature: providerStates.megallm.temperature,
    vscodeLmTemperature: providerStates['vscode-lm'].temperature,
    qwenCodeTemperature: providerStates['qwen-code'].temperature,
    streamingTimeout,
  };
}