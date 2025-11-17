import { useState, useRef, useCallback } from 'react';
import { PROVIDER_DEFAULTS, type Provider } from '../types/api-settings';

// Session-only cache for fetched models
const modelCache = new Map<string, string[]>();

export function useModelFetcher(
  provider: Provider,
  customBaseUrl: string | undefined,
  apiKey: string
) {
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const abortControllerRef = useRef<(() => void) | null>(null);

  // Generate cache key based on provider, url, and apiKey
  const getCacheKey = useCallback((prov: Provider, url: string | undefined, key: string) => {
    const baseUrl = url?.trim() || PROVIDER_DEFAULTS[prov].baseUrl;
    return `${prov}:${baseUrl}:${key}`;
  }, []);

  const fetchModels = useCallback((force = false) => {
    if (!apiKey) {
      setLoadingModels(false);
      setModels([]);
      return;
    }

    const cacheKey = getCacheKey(provider, customBaseUrl, apiKey);
    
    // Check cache first (unless force refresh)
    if (!force && modelCache.has(cacheKey)) {
      const cachedModels = modelCache.get(cacheKey)!;
      setModels(cachedModels);
      return;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current();
    }

    setLoadingModels(true);
    
    const baseUrl = customBaseUrl?.trim() || PROVIDER_DEFAULTS[provider].baseUrl;
    const modelsUrl = baseUrl.replace(/\/$/, '') + '/v1/models';
    
    const requestId = Date.now();
    let isActive = true;

    const handleResponse = (event: MessageEvent) => {
      const message = event.data;
      if (message.requestId === requestId && isActive) {
        if (message.type === 'apiResponse') {
          try {
            const data = JSON.parse(message.data);
            if (data.data && Array.isArray(data.data)) {
              // Filter models based on provider
              const allModels = data.data.map((m: { id: string }) => m.id);
              const filteredModels = allModels.filter((modelId: string) => {
                if (provider === 'anthropic') {
                  return modelId.toLowerCase().startsWith('claude');
                } else if (provider === 'openai') {
                  return modelId.toLowerCase().startsWith('gpt');
                } else if (provider === 'openai-compatible') {
                  return true;
                }
                return false;
              });
              setModels(filteredModels);
              // Store in cache
              modelCache.set(cacheKey, filteredModels);
            } else {
              setModels([]);
            }
          } catch {
            setModels([]);
          }
          setLoadingModels(false);
        } else if (message.type === 'apiError') {
          setModels([]);
          setLoadingModels(false);
        }
      }
    };

    window.addEventListener('message', handleResponse);
    
    const fetchTimeoutId = setTimeout(() => {
      if (isActive) {
        window.vscode.postMessage({
          type: 'apiRequest',
          requestId,
          url: modelsUrl,
          options: {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        });
      }
    }, 500);

    // Store cleanup function
    abortControllerRef.current = () => {
      isActive = false;
      clearTimeout(fetchTimeoutId);
      window.removeEventListener('message', handleResponse);
      setLoadingModels(false);
    };
  }, [provider, customBaseUrl, apiKey, getCacheKey]);

  const refetchModels = useCallback(() => {
    fetchModels(true);
  }, [fetchModels]);

  const clearCache = useCallback(() => {
    const cacheKey = getCacheKey(provider, customBaseUrl, apiKey);
    modelCache.delete(cacheKey);
  }, [provider, customBaseUrl, apiKey, getCacheKey]);

  return { models, loadingModels, fetchModels, refetchModels, clearCache };
}
