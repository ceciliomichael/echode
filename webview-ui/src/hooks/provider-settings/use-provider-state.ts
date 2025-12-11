import { useState, useEffect, useMemo } from 'react';
import type { ApiSettings, Provider } from '../../types/api-settings';
import type { ProviderStateMap, ProviderSettings } from './types';

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
 * Hook for managing provider state using a state map pattern
 * Replaces 30+ individual useState calls with a single structured state
 */
export function useProviderState(initialSettings: ApiSettings) {
  const [provider, setProvider] = useState<Provider>(initialSettings.provider);
  const [model, setModel] = useState(initialSettings.model);
  const [providerStates, setProviderStates] = useState<ProviderStateMap>(() =>
    initializeProviderStates(initialSettings)
  );
  const [qwenCodeOauthPath, setQwenCodeOauthPath] = useState(
    initialSettings.qwenCodeOauthPath || ''
  );
  const [streamingTimeout, setStreamingTimeout] = useState(
    initialSettings.streamingTimeout || 5000
  );

  // Compute current settings based on active provider
  const currentSettings: ProviderSettings = useMemo(() => {
    const state = providerStates[provider];
    return {
      customUrl: state.customUrl,
      apiKey: state.apiKey,
      model,
      maxTokens: state.maxTokens,
      temperature: state.temperature,
      qwenCodeOauthPath: provider === 'qwen-code' ? qwenCodeOauthPath : undefined,
    };
  }, [provider, providerStates, model, qwenCodeOauthPath]);

  // Sync with initial settings changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setProvider(initialSettings.provider);
      setModel(initialSettings.model);
      setProviderStates(initializeProviderStates(initialSettings));
      setQwenCodeOauthPath(initialSettings.qwenCodeOauthPath || '');
      setStreamingTimeout(initialSettings.streamingTimeout || 5000);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [initialSettings]);

  // Update a specific provider's state
  const updateProviderState = (
    targetProvider: Provider,
    updates: Partial<ProviderStateMap[Provider]>
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
    qwenCodeOauthPath,
    setQwenCodeOauthPath,
    streamingTimeout,
    setStreamingTimeout,
    updateProviderState,
  };
}