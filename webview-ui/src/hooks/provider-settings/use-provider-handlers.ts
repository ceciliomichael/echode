import { useMemo } from 'react';
import type { Provider, BuiltInProvider, CustomProvider, ReasoningEffort } from '../../types/api-settings';
import { isBuiltInProvider, isCustomProvider } from '../../types/api-settings';
import type { ProviderHandlers } from './types';

/**
 * Create handler functions for updating provider settings
 * Generic handlers that work with any provider
 */
export function useProviderHandlers(
  provider: Provider,
  updateProviderState: (
    targetProvider: BuiltInProvider,
    updates: Partial<{ customUrl: string; apiKey: string; maxTokens: number; temperature: number; reasoningEffort: ReasoningEffort }>
  ) => void,
  customProviders: CustomProvider[],
  updateCustomProvider: (provider: CustomProvider) => void
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
        // Handle built-in providers
        if (isBuiltInProvider(provider)) {
          updateProviderState(provider, { maxTokens: value });
          return;
        }

        // Handle custom providers
        if (isCustomProvider(provider)) {
          const id = provider.replace('custom-', '');
          const existingProvider = customProviders.find(p => p.id === id);
          if (existingProvider) {
            updateCustomProvider({
              ...existingProvider,
              maxTokens: value
            });
          }
        }
      },

      handleTemperatureChange: (value: number) => {
        // Handle built-in providers
        if (isBuiltInProvider(provider)) {
          updateProviderState(provider, { temperature: value });
          return;
        }

        // Handle custom providers
        if (isCustomProvider(provider)) {
          const id = provider.replace('custom-', '');
          const existingProvider = customProviders.find(p => p.id === id);
          if (existingProvider) {
            updateCustomProvider({
              ...existingProvider,
              temperature: value
            });
          }
        }
      },

      handleReasoningEffortChange: (value: ReasoningEffort | undefined) => {
        if (provider === 'openai-compatible' || provider === 'megallm') {
          updateProviderState(provider, { reasoningEffort: value });
        }
      },
    }),
    [provider, updateProviderState, customProviders, updateCustomProvider]
  );
}