import { useMemo } from 'react';
import type { Provider } from '../../types/api-settings';
import type { ProviderHandlers } from './types';

/**
 * Create handler functions for updating provider settings
 * Generic handlers that work with any provider
 */
export function useProviderHandlers(
  provider: Provider,
  updateProviderState: (
    targetProvider: Provider,
    updates: Partial<{ customUrl: string; apiKey: string; maxTokens: number; temperature: number }>
  ) => void
): ProviderHandlers {
  return useMemo(
    () => ({
      handleCustomUrlChange: (value: string) => {
        // Only certain providers support custom URLs
        if (
          provider === 'anthropic' ||
          provider === 'openai' ||
          provider === 'openai-compatible'
        ) {
          updateProviderState(provider, { customUrl: value });
        }
      },

      handleApiKeyChange: (value: string) => {
        // Only certain providers use API keys
        if (
          provider === 'anthropic' ||
          provider === 'openai' ||
          provider === 'openai-compatible' ||
          provider === 'megallm'
        ) {
          updateProviderState(provider, { apiKey: value });
        }
      },

      handleMaxTokensChange: (value: number) => {
        updateProviderState(provider, { maxTokens: value });
      },

      handleTemperatureChange: (value: number) => {
        updateProviderState(provider, { temperature: value });
      },
    }),
    [provider, updateProviderState]
  );
}