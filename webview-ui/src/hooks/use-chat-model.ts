import { useCallback, useEffect, useState, useMemo } from 'react';
import type { ApiSettings, Provider } from '../types/api-settings';
import type { ChatMode } from '../types/chat-mode';
import { storageService } from '../utils/storage';

interface ChatModelState {
  provider: Provider;
  model: string;
  settings: ApiSettings;
  setActiveProviderAndModel: (provider: Provider, model: string) => void;
}

/**
 * Hook to manage per-mode chat model selection
 * Each mode can have its own provider and model configuration
 * @param mode - The current chat mode to get/set model for
 */
export function useChatModel(mode: ChatMode): ChatModelState {
  const [settings, setSettings] = useState<ApiSettings>(() => storageService.getSettings());

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

  // Get mode-specific provider and model
  const modeModel = useMemo(() => {
    return storageService.getModeModel(mode);
  }, [mode, settings]);

  const setActiveProviderAndModel = useCallback(
    (provider: Provider, model: string) => {
      // Use the mode-aware storage helper
      storageService.setModeModel(mode, provider, model);
      
      // Update local state to trigger re-render
      setSettings(storageService.getSettings());
    },
    [mode]
  );

  return {
    provider: modeModel.provider,
    model: modeModel.model,
    settings,
    setActiveProviderAndModel,
  };
}