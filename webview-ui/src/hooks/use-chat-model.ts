import { useCallback, useEffect, useState } from 'react';
import type { ApiSettings, ChatMode, ModeModelConfig, Provider } from '../types/api-settings';
import { storageService } from '../utils/storage';

interface ChatModelState {
  provider: Provider;
  model: string;
  settings: ApiSettings;
  setActiveProviderAndModel: (provider: Provider, model: string) => void;
}

/**
 * Get the provider and model for a specific mode
 * Falls back to legacy settings if no mode-specific config exists
 */
function getModeModel(settings: ApiSettings, mode: ChatMode): ModeModelConfig {
  const modeConfig = settings.modeModels?.[mode];
  
  if (modeConfig?.provider && modeConfig?.model) {
    return modeConfig;
  }
  
  // Fallback to legacy global provider/model
  return {
    provider: settings.provider,
    model: settings.model,
  };
}

/**
 * Hook to manage chat model selection per mode
 * Each mode can have its own provider and model configuration
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

  const setActiveProviderAndModel = useCallback(
    (provider: Provider, model: string) => {
      const currentSettings = storageService.getSettings();
      
      // Update mode-specific model settings
      const updated: ApiSettings = {
        ...currentSettings,
        // Keep legacy fields updated for backwards compatibility
        provider,
        model,
        modeModels: {
          ...currentSettings.modeModels,
          [mode]: { provider, model },
        },
      };

      // Also update provider-specific model fields for compatibility
      if (provider === 'anthropic') {
        updated.anthropicModel = model;
      } else if (provider === 'openai') {
        updated.openaiModel = model;
      } else if (provider === 'openai-compatible') {
        updated.openaiCompatibleModel = model;
      } else if (provider === 'megallm') {
        updated.megallmModel = model;
      } else if (provider === 'vscode-lm') {
        updated.vscodeLmModel = model;
      } else if (provider === 'qwen-code') {
        updated.qwenCodeModel = model;
      }

      storageService.saveSettings(updated);

      if (window.vscode) {
        window.vscode.postMessage({
          type: 'saveSettings',
          settings: updated,
        });
      }

      setSettings(updated);
    },
    [mode]
  );

  // Get mode-specific provider/model
  const modeModel = getModeModel(settings, mode);

  return {
    provider: modeModel.provider,
    model: modeModel.model,
    settings,
    setActiveProviderAndModel,
  };
}