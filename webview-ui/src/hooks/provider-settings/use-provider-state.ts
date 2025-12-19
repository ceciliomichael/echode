import { useState, useEffect, useMemo } from 'react';
import type { ApiSettings, Provider, CustomProvider, BuiltInProvider } from '../../types/api-settings';
import { isCustomProvider, isBuiltInProvider } from '../../types/api-settings';
import type { ProviderStateMap, ProviderSettings, ProviderState } from './types';

/**
 * Initialize provider state map from ApiSettings
 */
function initializeProviderStates(settings: ApiSettings): ProviderStateMap {
  return {
    anthropic: {
      customUrl: settings.anthropicCustomUrl || '',
      apiKey: settings.anthropicApiKey || '',
      model: settings.anthropicModel || '',
      maxTokens: settings.anthropicMaxTokens,
      temperature: settings.anthropicTemperature,
    },
    openai: {
      customUrl: settings.openaiCustomUrl || '',
      apiKey: settings.openaiApiKey || '',
      model: settings.openaiModel || '',
      maxTokens: settings.openaiMaxTokens,
      temperature: settings.openaiTemperature,
    },
    'openai-compatible': {
      customUrl: settings.openaiCompatibleCustomUrl || '',
      apiKey: settings.openaiCompatibleApiKey || '',
      model: settings.openaiCompatibleModel || '',
      maxTokens: settings.openaiCompatibleMaxTokens,
      temperature: settings.openaiCompatibleTemperature,
    },
    megallm: {
      customUrl: '',
      apiKey: settings.megallmApiKey || '',
      model: '',
      maxTokens: settings.megallmMaxTokens,
      temperature: settings.megallmTemperature,
    },
    'vscode-lm': {
      customUrl: '',
      apiKey: '',
      model: settings.vscodeLmModel || '',
      maxTokens: settings.vscodeLmMaxTokens,
      temperature: settings.vscodeLmTemperature,
    },
    'qwen-code': {
      customUrl: '',
      apiKey: '',
      model: settings.qwenCodeModel || '',
      maxTokens: settings.qwenCodeMaxTokens,
      temperature: settings.qwenCodeTemperature,
    },
  };
}

/**
 * Extract custom provider ID from provider string (e.g., "custom-123" -> "123")
 */
function extractCustomProviderId(provider: Provider): string | null {
  if (isCustomProvider(provider)) {
    return provider.replace('custom-', '');
  }
  return null;
}

/**
 * Hook for managing provider state using a state map pattern
 * Replaces 30+ individual useState calls with a single structured state
 */
export function useProviderState(initialSettings: ApiSettings) {
  const [provider, setProvider] = useState<Provider>(initialSettings.provider);
  const [model, setModel] = useState(initialSettings.model);
  const [providerStates, setProviderStates] = useState<ProviderStateMap>(() =>
    initializeProviderStates(initialSettings)
  );
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>(
    initialSettings.customProviders || []
  );
  const [qwenCodeOauthPath, setQwenCodeOauthPath] = useState(
    initialSettings.qwenCodeOauthPath || ''
  );
  const [streamingTimeout, setStreamingTimeout] = useState(
    initialSettings.streamingTimeout || 5000
  );

  // Get the current custom provider if one is selected
  const currentCustomProvider = useMemo(() => {
    const customId = extractCustomProviderId(provider);
    if (customId) {
      return customProviders.find(cp => cp.id === customId) || null;
    }
    return null;
  }, [provider, customProviders]);

  // Compute current settings based on active provider
  const currentSettings: ProviderSettings = useMemo(() => {
    // Handle custom providers
    if (currentCustomProvider) {
      return {
        customUrl: currentCustomProvider.baseUrl,
        apiKey: currentCustomProvider.apiKey,
        model: currentCustomProvider.model || model,
        maxTokens: currentCustomProvider.maxTokens,
        temperature: currentCustomProvider.temperature,
      };
    }

    // Handle built-in providers
    if (isBuiltInProvider(provider)) {
      const state = providerStates[provider];
      return {
        customUrl: state.customUrl,
        apiKey: state.apiKey,
        model,
        maxTokens: state.maxTokens,
        temperature: state.temperature,
        qwenCodeOauthPath: provider === 'qwen-code' ? qwenCodeOauthPath : undefined,
      };
    }

    // Fallback to openai-compatible defaults
    const fallbackState = providerStates['openai-compatible'];
    return {
      customUrl: fallbackState.customUrl,
      apiKey: fallbackState.apiKey,
      model,
      maxTokens: fallbackState.maxTokens,
      temperature: fallbackState.temperature,
    };
  }, [provider, providerStates, model, qwenCodeOauthPath, currentCustomProvider]);

  // Sync with initial settings changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setProvider(initialSettings.provider);
      setModel(initialSettings.model);
      setProviderStates(initializeProviderStates(initialSettings));
      setCustomProviders(initialSettings.customProviders || []);
      setQwenCodeOauthPath(initialSettings.qwenCodeOauthPath || '');
      setStreamingTimeout(initialSettings.streamingTimeout || 5000);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [initialSettings]);

  // Update a specific built-in provider's state
  const updateProviderState = (
    targetProvider: BuiltInProvider,
    updates: Partial<ProviderState>
  ) => {
    setProviderStates((prev) => ({
      ...prev,
      [targetProvider]: {
        ...prev[targetProvider],
        ...updates,
      },
    }));
  };

  return {
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
  };
}