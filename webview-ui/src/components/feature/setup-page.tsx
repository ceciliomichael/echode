import { useState, useEffect } from 'react';
import { SettingsSidebar } from '../ui/settings-sidebar';
import { SettingsDropdown } from '../ui/settings-dropdown';
import { ApiConfigTab } from './api-config-tab';
import { SystemPromptTab } from './system-prompt-tab';
import { useModelFetcher } from '../../hooks/use-model-fetcher';
import { useProviderSettings } from '../../hooks/use-provider-settings';
import type { ApiSettings } from '../../types/api-settings';

interface SetupPageProps {
  initialSettings: ApiSettings;
  onSave: (settings: ApiSettings) => void;
  onClose?: () => void;
}

export function SetupPage({ initialSettings, onSave }: SetupPageProps) {
  const [systemPrompt, setSystemPrompt] = useState(initialSettings.systemPrompt || '');
  const [activeTab, setActiveTab] = useState<'api' | 'system'>('api');
  const [showDropdown, setShowDropdown] = useState(false);

  const {
    provider,
    currentSettings,
    model,
    setModel,
    handleProviderChange,
    handleCustomUrlChange,
    handleMaxTokensChange,
    handleTemperatureChange,
    handleApiKeyChange,
    buildSettings,
  } = useProviderSettings(initialSettings);

  const { models, loadingModels, fetchModels, refetchModels, clearCache } = useModelFetcher(
    provider,
    currentSettings.customUrl,
    currentSettings.apiKey
  );

  // Clear cache when provider changes
  useEffect(() => {
    clearCache();
  }, [provider, clearCache]);

  // Clear cache and fetch models when customUrl changes
  useEffect(() => {
    clearCache();
    if (currentSettings.apiKey) {
      const timeoutId = setTimeout(() => {
        fetchModels(true);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [currentSettings.customUrl, currentSettings.apiKey, clearCache, fetchModels]);

  // Clear model if it's not in the fetched models list
  useEffect(() => {
    if (model && models.length > 0 && !models.includes(model)) {
      setTimeout(() => setModel(''), 0);
    }
  }, [models, model, setModel]);

  // Sync system prompt with initial settings
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSystemPrompt(initialSettings.systemPrompt || '');
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [initialSettings]);

  // Auto-save settings
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onSave({
        ...buildSettings(),
        systemPrompt,
      });
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [provider, currentSettings, model, systemPrompt, onSave, buildSettings]);

  const handleModelDropdownOpen = () => {
    if (currentSettings.apiKey) {
      fetchModels();
    }
  };

  const handleRefreshModels = () => {
    refetchModels();
  };

  return (
    <div
      className="flex flex-col sm:flex-row h-screen"
      style={{ backgroundColor: 'var(--vscode-editor-background)' }}
    >
      <SettingsDropdown
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOpen={showDropdown}
        onToggle={() => setShowDropdown(!showDropdown)}
      />

      <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          className="flex items-center px-4 sm:px-5 h-12 sm:h-14 border-b shrink-0"
          style={{
            borderColor: 'var(--vscode-panel-border)',
            backgroundColor: 'var(--vscode-editor-background)'
          }}
        >
          <h1
            className="text-sm sm:text-base font-semibold"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            {activeTab === 'api' ? 'API Configuration' : 'System Prompt'}
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto py-4 sm:py-6 px-4 sm:px-5">
          {activeTab === 'api' && (
            <ApiConfigTab
              provider={provider}
              customBaseUrl={currentSettings.customUrl}
              apiKey={currentSettings.apiKey}
              model={model}
              maxTokens={currentSettings.maxTokens}
              temperature={currentSettings.temperature}
              models={models}
              loadingModels={loadingModels}
              onProviderChange={handleProviderChange}
              onCustomBaseUrlChange={handleCustomUrlChange}
              onApiKeyChange={handleApiKeyChange}
              onModelChange={setModel}
              onMaxTokensChange={handleMaxTokensChange}
              onTemperatureChange={handleTemperatureChange}
              onModelDropdownOpen={handleModelDropdownOpen}
              onRefreshModels={handleRefreshModels}
            />
          )}

          {activeTab === 'system' && (
            <SystemPromptTab value={systemPrompt} onChange={setSystemPrompt} />
          )}
        </div>
      </div>
    </div>
  );
}