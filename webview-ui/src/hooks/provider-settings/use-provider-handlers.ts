import { useMemo } from 'react';
import type { Provider, BuiltInProvider } from '../../types/api-settings';
import { isBuiltInProvider } from '../../types/api-settings';
import type { ProviderHandlers } from './types';

/**
 * Create handler functions for updating provider settings
 * Generic handlers that work with any provider
 */
export function useProviderHandlers(
  provider: Provider,
  updateProviderState: (
    targetProvider: BuiltInProvider,
    updates: Partial<{ customUrl: string; apiKey: string; maxTokens: number; temperature: number }>
  ) => void
): ProviderHandlers {
  return useMemo(
    () => ({
      handleCustomUrlChange: (value: string) => {
        // Only certain built-in providers support custom URLs
        if (
          provider === 'anthropic' ||
          provider === 'openai' ||
          provider === 'openai-compatible'
        ) {
          updateProviderState(provider, { customUrl: value });
        }
      },

      handleApiKeyChange: (value: string) => {
        // Only certain built-in providers use API keys
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
        // Only update for built-in providers
        if (isBuiltInProvider(provider)) {
          updateProviderState(provider, { maxTokens: value });
        }
      },

      handleTemperatureChange: (value: number) => {
        // Only update for built-in providers
        if (isBuiltInProvider(provider)) {
          updateProviderState(provider, { temperature: value });
        }
      },
    }),
    [provider, updateProviderState]
  );
}