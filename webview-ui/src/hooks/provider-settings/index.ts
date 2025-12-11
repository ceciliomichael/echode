import type { ApiSettings, Provider } from '../../types/api-settings';
import type { UseProviderSettingsReturn } from './types';
import { useProviderState } from './use-provider-state';
import { useProviderHandlers } from './use-provider-handlers';
import { handleProviderSwitch, saveCurrentModelToProvider } from './provider-model-manager';
import { buildApiSettings } from './provider-settings-builder';

/**
 * Main hook for managing provider settings
 * Orchestrates state management, handlers, and settings building
 */
export function useProviderSettings(initialSettings: ApiSettings): UseProviderSettingsReturn {
  const {
    provider,
    setProvider,
    model,
    setModel,
    providerStates,
    setProviderStates,
    currentSettings,
    qwenCodeOauthPath,
    setQwenCodeOauthPath,
    streamingTimeout,
    setStreamingTimeout,
    updateProviderState,
  } = useProviderState(initialSettings);

  const handlers = useProviderHandlers(provider, updateProviderState);

  // Handle provider switching with model persistence
  const handleProviderChange = (newProvider: Provider) => {
    // Save current model to current provider state
    const updatedStates = saveCurrentModelToProvider(provider, model, providerStates);
    setProviderStates(updatedStates);

    // Get saved model for new provider
    const { savedModelForNewProvider } = handleProviderSwitch(newProvider, updatedStates);

    // Switch to new provider
    setProvider(newProvider);

    // Restore the saved model for the new provider
    setModel(savedModelForNewProvider);
  };

  // Build complete settings object
  const buildSettings = (): ApiSettings => {
    return buildApiSettings(
      provider,
      providerStates,
      currentSettings,
      qwenCodeOauthPath,
      streamingTimeout
    );
  };

  // Special handlers for qwen-code and streaming timeout
  const handleQwenCodeOauthPathChange = (value: string) => {
    setQwenCodeOauthPath(value);
  };

  const handleStreamingTimeoutChange = (value: number) => {
    setStreamingTimeout(value);
  };

  return {
    provider,
    currentSettings,
    model,
    setModel,
    handleProviderChange,
    handleCustomUrlChange: handlers.handleCustomUrlChange,
    handleMaxTokensChange: handlers.handleMaxTokensChange,
    handleTemperatureChange: handlers.handleTemperatureChange,
    handleApiKeyChange: handlers.handleApiKeyChange,
    handleQwenCodeOauthPathChange,
    handleStreamingTimeoutChange,
    streamingTimeout,
    buildSettings,
    allSettings: {
      anthropicCustomUrl: providerStates.anthropic.customUrl,
      openaiCustomUrl: providerStates.openai.customUrl,
      openaiCompatibleCustomUrl: providerStates['openai-compatible'].customUrl,
      anthropicModel: providerStates.anthropic.model,
      openaiModel: providerStates.openai.model,
      openaiCompatibleModel: providerStates['openai-compatible'].model,
      vscodeLmModel: providerStates['vscode-lm'].model,
      qwenCodeModel: providerStates['qwen-code'].model,
      anthropicApiKey: providerStates.anthropic.apiKey,
      openaiApiKey: providerStates.openai.apiKey,
      openaiCompatibleApiKey: providerStates['openai-compatible'].apiKey,
      qwenCodeOauthPath,
      anthropicMaxTokens: providerStates.anthropic.maxTokens,
      openaiMaxTokens: providerStates.openai.maxTokens,
      openaiCompatibleMaxTokens: providerStates['openai-compatible'].maxTokens,
      vscodeLmMaxTokens: providerStates['vscode-lm'].maxTokens,
      qwenCodeMaxTokens: providerStates['qwen-code'].maxTokens,
      anthropicTemperature: providerStates.anthropic.temperature,
      openaiTemperature: providerStates.openai.temperature,
      openaiCompatibleTemperature: providerStates['openai-compatible'].temperature,
      vscodeLmTemperature: providerStates['vscode-lm'].temperature,
      qwenCodeTemperature: providerStates['qwen-code'].temperature,
    },
  };
}