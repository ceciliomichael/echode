import { useCallback, useEffect, useState } from 'react';
import type { ApiSettings, Provider } from '../types/api-settings';
import type { ChatMode } from '../types/chat-mode';
import { storageService } from '../utils/storage';

interface ChatModelState {
  provider: Provider;
  model: string;
  settings: ApiSettings;
  setActiveProviderAndModel: (provider: Provider, model: string) => void;
}

export function useChatModel(mode?: ChatMode): ChatModelState {
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
      let updated: ApiSettings = {
        ...currentSettings,
      };

      // If a mode is active, save to mode-specific settings
      if (mode) {
        updated.modeModelSettings = {
          ...updated.modeModelSettings,
          [mode]: {
            provider,
            model
          }
        };
      } else {
        // Fallback to global settings update (legacy behavior)
        updated.provider = provider;
        updated.model = model;

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

  // Determine active provider/model based on mode
  let activeProvider = settings.provider;
  let activeModel = settings.model;

  if (mode && settings.modeModelSettings?.[mode]) {
    activeProvider = settings.modeModelSettings[mode].provider;
    activeModel = settings.modeModelSettings[mode].model;
  }

  return {
    provider: activeProvider,
    model: activeModel,
    settings,
    setActiveProviderAndModel,
  };
}
