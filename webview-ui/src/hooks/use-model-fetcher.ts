import { useState, useRef, useCallback } from 'react';
import { getProviderDefaults, type Provider } from '../types/api-settings';

// Session-only cache for fetched models
const modelCache = new Map<string, string[]>();

export function useModelFetcher(
  provider: Provider,
  customBaseUrl: string | undefined,
  apiKey: string
) {
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const requestIdRef = useRef<number | null>(null);

  // Generate cache key based on provider, url, and apiKey
  const getCacheKey = useCallback((prov: Provider, url: string | undefined, key: string) => {
    const baseUrl = url?.trim() || getProviderDefaults(prov).baseUrl;
    return `${prov}:${baseUrl}:${key}`;
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
    const requestId = Date.now();
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
