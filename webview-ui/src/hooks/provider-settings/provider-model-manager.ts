import type { Provider } from '../../types/api-settings';
import type { ProviderStateMap } from './types';

/**
 * Handle provider switching with model persistence
 * Returns the saved model for the new provider
 */
export function handleProviderSwitch(
  newProvider: Provider,
  providerStates: ProviderStateMap
): { savedModelForNewProvider: string } {
  // Get the saved model for the new provider before any state updates
  const savedModelForNewProvider = providerStates[newProvider].model;

  return { savedModelForNewProvider };
}

/**
 * Update provider state with current model before switching
 */
export function saveCurrentModelToProvider(
  provider: Provider,
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