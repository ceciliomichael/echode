import type { ApiSettings, Provider, CustomProvider } from '../../types/api-settings';
import { isBuiltInProvider } from '../../types/api-settings';
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
    customProviders,
    setCustomProviders,
    qwenCodeOauthPath,
    setQwenCodeOauthPath,
    streamingTimeout,
    setStreamingTimeout,
    updateProviderState,
  } = useProviderState(initialSettings);

  // Handle provider switching with model persistence
  const handleProviderChange = (newProvider: Provider) => {
    // Only save model for built-in providers
    if (isBuiltInProvider(provider)) {
      const updatedStates = saveCurrentModelToProvider(provider, model, providerStates);
      setProviderStates(updatedStates);
    }

    // Get saved model for new provider (only for built-in providers)
    if (isBuiltInProvider(newProvider)) {
      const { savedModelForNewProvider } = handleProviderSwitch(newProvider, providerStates);
      setModel(savedModelForNewProvider);
    } else {
      // For custom providers, get the model from the custom provider config
      const customId = newProvider.replace('custom-', '');
      const customProvider = customProviders.find(cp => cp.id === customId);
      if (customProvider) {
        setModel(customProvider.model || '');
      }
    }

    // Switch to new provider
    setProvider(newProvider);
  };

  // Custom provider handlers
  const handleAddCustomProvider = (newProvider: CustomProvider) => {
    setCustomProviders(prev => [...prev, newProvider]);
  };

  const handleUpdateCustomProvider = (updatedProvider: CustomProvider) => {
    setCustomProviders(prev =>
      prev.map(p => p.id === updatedProvider.id ? updatedProvider : p)
    );
  };

  const handleDeleteCustomProvider = (id: string) => {
    setCustomProviders(prev => prev.filter(p => p.id !== id));
    // If the deleted provider was selected, switch to anthropic
    if (provider === `custom-${id}`) {
      setProvider('anthropic');
      setModel(providerStates.anthropic.model);
    }
  };

  const handlers = useProviderHandlers(
    provider,
    updateProviderState,
    customProviders,
    handleUpdateCustomProvider
  );

  // Build complete settings object
  const buildSettings = (): ApiSettings => {
    const settings = buildApiSettings(
      provider,
      providerStates,
      currentSettings,
      qwenCodeOauthPath,
      streamingTimeout
    );
    // Add custom providers to settings
    return {
      ...settings,
      customProviders,
    };
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
    handleReasoningEffortChange: handlers.handleReasoningEffortChange,
    handleZaiThinkingChange: handlers.handleZaiThinkingChange,
    handleQwenCodeOauthPathChange,
    handleStreamingTimeoutChange,
    streamingTimeout,
    buildSettings,
    // Custom providers
    customProviders,
    handleAddCustomProvider,
    handleUpdateCustomProvider,
    handleDeleteCustomProvider,
    allSettings: {
      anthropicCustomUrl: providerStates.anthropic.customUrl,
      openaiCustomUrl: providerStates.openai.customUrl,
      openaiCompatibleCustomUrl: providerStates['openai-compatible'].customUrl,
      zaiCustomUrl: providerStates.zai.customUrl,
      anthropicModel: providerStates.anthropic.model,
      openaiModel: providerStates.openai.model,
      openaiCompatibleModel: providerStates['openai-compatible'].model,
      vscodeLmModel: providerStates['vscode-lm'].model,
      qwenCodeModel: providerStates['qwen-code'].model,
      zaiModel: providerStates.zai.model,
      anthropicApiKey: providerStates.anthropic.apiKey,
      openaiApiKey: providerStates.openai.apiKey,
      openaiCompatibleApiKey: providerStates['openai-compatible'].apiKey,
      zaiApiKey: providerStates.zai.apiKey,
      openaiCompatibleReasoningEffort: providerStates['openai-compatible'].reasoningEffort,
      megallmReasoningEffort: providerStates.megallm.reasoningEffort,
      qwenCodeOauthPath,
      anthropicMaxTokens: providerStates.anthropic.maxTokens,
      openaiMaxTokens: providerStates.openai.maxTokens,
      openaiCompatibleMaxTokens: providerStates['openai-compatible'].maxTokens,
      vscodeLmMaxTokens: providerStates['vscode-lm'].maxTokens,
      qwenCodeMaxTokens: providerStates['qwen-code'].maxTokens,
      zaiMaxTokens: providerStates.zai.maxTokens,
      anthropicTemperature: providerStates.anthropic.temperature,
      openaiTemperature: providerStates.openai.temperature,
      openaiCompatibleTemperature: providerStates['openai-compatible'].temperature,
      vscodeLmTemperature: providerStates['vscode-lm'].temperature,
      qwenCodeTemperature: providerStates['qwen-code'].temperature,
      zaiTemperature: providerStates.zai.temperature,
      zaiThinking: providerStates.zai.zaiThinking ?? false,
    },
  };
}