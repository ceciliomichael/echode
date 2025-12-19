import type { BuiltInProvider } from '../../types/api-settings';
import type { ProviderStateMap } from './types';

/**
 * Handle provider switching with model persistence
 * Returns the saved model for the new provider
 * Note: Only works with built-in providers, not custom providers
 */
export function handleProviderSwitch(
  newProvider: BuiltInProvider,
  providerStates: ProviderStateMap
): { savedModelForNewProvider: string } {
  // Get the saved model for the new provider before any state updates
  const savedModelForNewProvider = providerStates[newProvider].model;

  return { savedModelForNewProvider };
}

/**
 * Update provider state with current model before switching
 * Note: Only works with built-in providers, not custom providers
 */
export function saveCurrentModelToProvider(
  provider: BuiltInProvider,
  currentModel: string,
  providerStates: ProviderStateMap
): ProviderStateMap {
  return {
    ...providerStates,
    [provider]: {
      ...providerStates[provider],
      model: currentModel,
    },
  };
}