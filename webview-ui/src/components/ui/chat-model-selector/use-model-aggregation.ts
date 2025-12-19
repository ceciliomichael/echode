import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ApiSettings, Provider } from '../../../types/api-settings';
import { storageService } from '../../../utils/storage';
import { useModelFetcher } from '../../../hooks/use-model-fetcher';
import type { ModelItem } from './types';

export function useModelAggregation(isOpen: boolean) {
  const [settings, setSettings] = useState<ApiSettings>(() => storageService.getSettings());
  const [customModels, setCustomModels] = useState<Record<string, { models: string[]; loading: boolean }>>({});

  useEffect(() => {
    const handleSettingsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<ApiSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      } else {
        setSettings(storageService.getSettings());
      }
    };

    window.addEventListener('settingsUpdated', handleSettingsUpdated as EventListener);
    return () => {
      window.removeEventListener('settingsUpdated', handleSettingsUpdated as EventListener);
    };
  }, []);

  const anthropicKey = settings.anthropicApiKey || '';
  const openaiKey = settings.openaiApiKey || '';
  const openaiCompatibleKey = settings.openaiCompatibleApiKey || '';
  const megallmKey = settings.megallmApiKey || '';

  const {
    models: anthropicModels,
    loadingModels: loadingAnthropic,
    fetchModels: fetchAnthropic,
  } = useModelFetcher('anthropic', settings.anthropicCustomUrl, anthropicKey);

  const {
    models: openaiModels,
    loadingModels: loadingOpenai,
    fetchModels: fetchOpenai,
  } = useModelFetcher('openai', settings.openaiCustomUrl, openaiKey);

  const {
    models: openaiCompatibleModels,
    loadingModels: loadingOpenaiCompatible,
    fetchModels: fetchOpenaiCompatible,
  } = useModelFetcher('openai-compatible', settings.openaiCompatibleCustomUrl, openaiCompatibleKey);

  const {
    models: megallmModels,
    loadingModels: loadingMegallm,
    fetchModels: fetchMegallm,
  } = useModelFetcher('megallm', settings.megallmCustomUrl, megallmKey);

  const {
    models: vscodeLmModels,
    loadingModels: loadingVscodeLm,
    fetchModels: fetchVscodeLm,
  } = useModelFetcher('vscode-lm', undefined, '');

  const {
    models: qwenCodeModels,
    loadingModels: loadingQwenCode,
    fetchModels: fetchQwenCode,
  } = useModelFetcher('qwen-code', undefined, '');

  const refreshModels = useCallback(() => {
    fetchAnthropic();
    fetchOpenai();
    fetchOpenaiCompatible();
    fetchMegallm();
    fetchVscodeLm();
    fetchQwenCode();
  }, [fetchAnthropic, fetchOpenai, fetchOpenaiCompatible, fetchMegallm, fetchVscodeLm, fetchQwenCode]);

  useEffect(() => {
    refreshModels();
  }, [refreshModels]);

  useEffect(() => {
    if (isOpen) {
      refreshModels();
    }
  }, [isOpen, refreshModels]);

  const handleCustomModelsFetched = useCallback((provider: Provider, models: string[], loading: boolean) => {
    setCustomModels(prev => {
      const current = prev[provider];
      if (current && current.loading === loading && JSON.stringify(current.models) === JSON.stringify(models)) {
        return prev;
      }
      return {
        ...prev,
        [provider]: { models, loading }
      };
    });
  }, []);

  const allModels = useMemo(() => {
    const models: ModelItem[] = [];

    if (anthropicModels) models.push(...anthropicModels.map(m => ({ provider: 'anthropic' as Provider, providerLabel: 'Anthropic', model: m })));
    if (openaiModels) models.push(...openaiModels.map(m => ({ provider: 'openai' as Provider, providerLabel: 'OpenAI', model: m })));
    if (openaiCompatibleModels) models.push(...openaiCompatibleModels.map(m => ({ provider: 'openai-compatible' as Provider, providerLabel: 'OpenAI Compatible', model: m })));
    if (megallmModels) models.push(...megallmModels.map(m => ({ provider: 'megallm' as Provider, providerLabel: 'MEGALLM', model: m })));
    if (vscodeLmModels) models.push(...vscodeLmModels.map(m => ({ provider: 'vscode-lm' as Provider, providerLabel: 'VS Code LM (Copilot)', model: m })));
    if (qwenCodeModels) models.push(...qwenCodeModels.map(m => ({ provider: 'qwen-code' as Provider, providerLabel: 'Qwen Code', model: m })));

    if (settings.customProviders) {
      settings.customProviders.forEach(cp => {
        const providerId = `custom-${cp.id}`;
        const data = customModels[providerId];
        if (data && data.models) {
          models.push(...data.models.map(m => ({
            provider: providerId as Provider,
            providerLabel: cp.name,
            model: m
          })));
        }
      });
    }

    return models;
  }, [anthropicModels, openaiModels, openaiCompatibleModels, megallmModels, vscodeLmModels, qwenCodeModels, customModels, settings.customProviders]);

  const anyLoading =
    loadingAnthropic ||
    loadingOpenai ||
    loadingOpenaiCompatible ||
    loadingMegallm ||
    loadingVscodeLm ||
    loadingQwenCode ||
    Object.values(customModels).some(m => m.loading);

  return {
    allModels,
    anyLoading,
    refreshModels,
    settings,
    handleCustomModelsFetched
  };
}