import { useState, useRef, useCallback, useEffect } from 'react';
import { getProviderDefaults, isCustomProvider, type Provider } from '../types/api-settings';
import type { ApiSettings } from '../types/api-settings';

// Session-only cache for fetched models
const modelCache = new Map<string, string[]>();

// Global counter for unique request IDs (avoids collision when multiple hooks call simultaneously)
let requestIdCounter = 0;

// Track if prefetch has been initiated
let prefetchInitiated = false;

const MODELS_REFRESH_EVENT = 'echodeModelsRefresh';
const MODELS_CACHE_UPDATE_EVENT = 'echodeModelsCacheUpdate';

export function requestModelsRefresh() {
  window.dispatchEvent(new Event(MODELS_REFRESH_EVENT));
}

// Helper to generate cache key (used both inside and outside hook)
function generateCacheKey(prov: Provider, url: string | undefined, key: string) {
  const baseUrl = url?.trim() || getProviderDefaults(prov).baseUrl;
  return `${prov}:${baseUrl}:${key}`;
}

// Notify all hook instances that cache has been updated for a specific key
function notifyCacheUpdate(cacheKey: string, models: string[]) {
  window.dispatchEvent(new CustomEvent(MODELS_CACHE_UPDATE_EVENT, {
    detail: { cacheKey, models }
  }));
}

// Standalone prefetch function to populate cache at app startup
export function prefetchAllModels(settings: ApiSettings) {
  if (prefetchInitiated || !window.vscode) return;
  prefetchInitiated = true;

  // For model fetching, only use provider-specific keys (no global fallback)
  // This prevents unwanted API calls when a provider isn't explicitly configured
  const providers: { provider: Provider; url: string | undefined; key: string }[] = [
    { provider: 'anthropic', url: settings.anthropicCustomUrl, key: settings.anthropicApiKey || '' },
    { provider: 'openai', url: settings.openaiCustomUrl, key: settings.openaiApiKey || '' },
    { provider: 'openai-compatible', url: settings.openaiCompatibleCustomUrl, key: settings.openaiCompatibleApiKey || '' },
    { provider: 'megallm', url: settings.megallmCustomUrl, key: settings.megallmApiKey || '' },
    { provider: 'vscode-lm', url: undefined, key: '' },
    { provider: 'qwen-code', url: undefined, key: '' },
  ];

  // Add custom providers to prefetch list
  if (settings.customProviders) {
    settings.customProviders.forEach(cp => {
      providers.push({
        provider: `custom-${cp.id}` as Provider,
        url: cp.baseUrl,
        key: cp.apiKey
      });
    });
  }

  for (const { provider, url, key } of providers) {
    // Skip providers without API key (except vscode-lm, qwen-code, openai-compatible, and custom providers)
    const isCustom = isCustomProvider(provider);
    const isOptionalKey = provider === 'vscode-lm' || provider === 'qwen-code' || provider === 'openai-compatible' || isCustom;
    
    if (!isOptionalKey && !key) continue;

    const cacheKey = generateCacheKey(provider, url, key || 'no-key');
    if (modelCache.has(cacheKey)) continue;

    const baseURL = url?.trim() || getProviderDefaults(provider).baseUrl;
    requestIdCounter += 1;
    const requestId = `prefetch-${Date.now()}-${requestIdCounter}-${provider}`;

    const handleResponse = (event: MessageEvent) => {
      const message = event.data;
      if (message.requestId === requestId) {
        if (message.type === 'modelsResponse') {
          modelCache.set(cacheKey, message.models);
          // Notify all hook instances about the cache update
          notifyCacheUpdate(cacheKey, message.models);
        }
        window.removeEventListener('message', handleResponse);
      }
    };

    window.addEventListener('message', handleResponse);
    window.vscode.postMessage({ type: 'fetchModels', requestId, provider, apiKey: key, baseURL });
  }
}

export function useModelFetcher(
  provider: Provider,
  customBaseUrl: string | undefined,
  apiKey: string
) {
  // Generate cache key for this hook instance
  const cacheKey = generateCacheKey(provider, customBaseUrl, apiKey || 'no-key');

  // Initialize from cache if available (prevents redundant fetches)
  const [models, setModels] = useState<string[]>(() => {
    return modelCache.get(cacheKey) || [];
  });
  const [loadingModels, setLoadingModels] = useState(false);
  const requestIdRef = useRef<string | null>(null);

  // Listen for cache updates from other hook instances
  useEffect(() => {
    const handleCacheUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ cacheKey: string; models: string[] }>;
      if (customEvent.detail.cacheKey === cacheKey) {
        setModels(customEvent.detail.models);
        setLoadingModels(false);
      }
    };

    window.addEventListener(MODELS_CACHE_UPDATE_EVENT, handleCacheUpdate);

    return () => {
      window.removeEventListener(MODELS_CACHE_UPDATE_EVENT, handleCacheUpdate);
    };
  }, [cacheKey]);

  const fetchModels = useCallback((force = false) => {
    // Check if provider requires API key
    const isCustom = isCustomProvider(provider);
    const isOptionalKey = provider === 'vscode-lm' || provider === 'qwen-code' || provider === 'openai-compatible' || isCustom;

    if (!window.vscode || (!isOptionalKey && !apiKey)) {
      setLoadingModels(false);
      setModels([]);
      return;
    }

    // Check cache first (unless force refresh)
    if (!force && modelCache.has(cacheKey)) {
      const cachedModels = modelCache.get(cacheKey)!;
      setModels(cachedModels);
      return;
    }

    setLoadingModels(true);

    const baseURL = customBaseUrl?.trim() || getProviderDefaults(provider).baseUrl;
    // Use counter + timestamp + provider to ensure unique request IDs across simultaneous calls
    requestIdCounter += 1;
    const requestId = `${Date.now()}-${requestIdCounter}-${provider}`;
    requestIdRef.current = requestId;

    const handleResponse = (event: MessageEvent) => {
      const message = event.data;
      if (message.requestId === requestId) {
        if (message.type === 'modelsResponse') {
          modelCache.set(cacheKey, message.models);
          // Notify all hook instances about the cache update (including self)
          notifyCacheUpdate(cacheKey, message.models);
          window.removeEventListener('message', handleResponse);
        } else if (message.type === 'modelsError') {
          console.error('[Model Fetcher] Error:', message.error);
          setModels([]);
          setLoadingModels(false);
          window.removeEventListener('message', handleResponse);
        }
      }
    };

    window.addEventListener('message', handleResponse);

    // Send request to backend
    window.vscode.postMessage({
      type: 'fetchModels',
      requestId,
      provider,
      apiKey,
      baseURL
    });
  }, [provider, customBaseUrl, apiKey, cacheKey]);

  const refetchModels = useCallback(() => {
    fetchModels(true);
  }, [fetchModels]);

  const clearCache = useCallback(() => {
    modelCache.delete(cacheKey);
  }, [cacheKey]);

  // Listen for global refresh requests
  useEffect(() => {
    const handleGlobalRefresh = () => {
      fetchModels(true);
    };

    window.addEventListener(MODELS_REFRESH_EVENT, handleGlobalRefresh);

    return () => {
      window.removeEventListener(MODELS_REFRESH_EVENT, handleGlobalRefresh);
    };
  }, [fetchModels]);

  return { models, loadingModels, fetchModels, refetchModels, clearCache };
}
