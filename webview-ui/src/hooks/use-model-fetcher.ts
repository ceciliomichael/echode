import { useState, useRef, useCallback } from 'react';
import { getProviderDefaults, type Provider } from '../types/api-settings';
import type { ApiSettings } from '../types/api-settings';

// Session-only cache for fetched models
const modelCache = new Map<string, string[]>();

// Global counter for unique request IDs (avoids collision when multiple hooks call simultaneously)
let requestIdCounter = 0;

// Track if prefetch has been initiated
let prefetchInitiated = false;

// Helper to generate cache key (used both inside and outside hook)
function generateCacheKey(prov: Provider, url: string | undefined, key: string) {
  const baseUrl = url?.trim() || getProviderDefaults(prov).baseUrl;
  return `${prov}:${baseUrl}:${key}`;
}

// Standalone prefetch function to populate cache at app startup
export function prefetchAllModels(settings: ApiSettings) {
  if (prefetchInitiated || !window.vscode) return;
  prefetchInitiated = true;

  const providers: { provider: Provider; url: string | undefined; key: string }[] = [
    { provider: 'anthropic', url: settings.anthropicCustomUrl, key: settings.anthropicApiKey || settings.apiKey || '' },
    { provider: 'openai', url: settings.openaiCustomUrl, key: settings.openaiApiKey || settings.apiKey || '' },
    { provider: 'openai-compatible', url: settings.openaiCompatibleCustomUrl, key: settings.openaiCompatibleApiKey || settings.apiKey || '' },
    { provider: 'megallm', url: settings.megallmCustomUrl, key: settings.megallmApiKey || settings.apiKey || '' },
    { provider: 'vscode-lm', url: undefined, key: '' },
    { provider: 'qwen-code', url: undefined, key: '' },
  ];

  for (const { provider, url, key } of providers) {
    // Skip providers without API key (except vscode-lm and qwen-code)
    if (provider !== 'vscode-lm' && provider !== 'qwen-code' && !key) continue;

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
  // Initialize from cache if available (prevents redundant fetches)
  const [models, setModels] = useState<string[]>(() => {
    const cacheKey = generateCacheKey(provider, customBaseUrl, apiKey || 'no-key');
    return modelCache.get(cacheKey) || [];
  });
  const [loadingModels, setLoadingModels] = useState(false);
  const requestIdRef = useRef<string | null>(null);

  // Generate cache key based on provider, url, and apiKey
  const getCacheKey = useCallback((prov: Provider, url: string | undefined, key: string) => {
    return generateCacheKey(prov, url, key);
  }, []);

  const fetchModels = useCallback((force = false) => {
    // VS Code LM and Qwen Code don't require API key, skip check for them
    if (!window.vscode || (provider !== 'vscode-lm' && provider !== 'qwen-code' && !apiKey)) {
      setLoadingModels(false);
      setModels([]);
      return;
    }

    const cacheKey = getCacheKey(provider, customBaseUrl, apiKey || 'no-key');
    
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
          setModels(message.models);
          modelCache.set(cacheKey, message.models);
          setLoadingModels(false);
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
  }, [provider, customBaseUrl, apiKey, getCacheKey]);

  const refetchModels = useCallback(() => {
    fetchModels(true);
  }, [fetchModels]);

  const clearCache = useCallback(() => {
    const cacheKey = getCacheKey(provider, customBaseUrl, apiKey || 'no-key');
    modelCache.delete(cacheKey);
  }, [provider, customBaseUrl, apiKey, getCacheKey]);

  return { models, loadingModels, fetchModels, refetchModels, clearCache };
}
