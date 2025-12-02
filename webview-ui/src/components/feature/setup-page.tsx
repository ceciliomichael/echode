import { useState, useEffect } from 'react';

import { SettingsSidebar } from '../ui/settings-sidebar';
import { SettingsDropdown } from '../ui/settings-dropdown';
import { ApiConfigTab } from './api-config-tab';
import { SystemPromptTab } from './system-prompt-tab';
import { ToolsTab } from './tools-tab';
import { IndexingTab } from './indexing-tab';

import { useProviderSettings } from '../../hooks/use-provider-settings';
import { getAllTools } from '../../lib/tool-config';
import type { ApiSettings, Tool, IndexingSettings } from '../../types/api-settings';
import { DEFAULT_INDEXING_SETTINGS } from '../../types/api-settings';

interface SetupPageProps {
  initialSettings: ApiSettings;
  onSave: (settings: ApiSettings) => void;
  onClose?: () => void;
}

export function SetupPage({ initialSettings, onSave }: SetupPageProps) {
  const [systemPrompt, setSystemPrompt] = useState(initialSettings.systemPrompt || '');
  const [enabledTools, setEnabledTools] = useState<Tool[]>(
    initialSettings.enabledTools || getAllTools(true)
  );
  const [indexingSettings, setIndexingSettings] = useState<IndexingSettings>(
    initialSettings.indexingSettings || DEFAULT_INDEXING_SETTINGS
  );
  const [activeTab, setActiveTab] = useState<'api' | 'system' | 'tools' | 'indexing'>('api');
  const [showDropdown, setShowDropdown] = useState(false);

  const {
    provider,
    currentSettings,
    handleProviderChange,
    handleCustomUrlChange,
    handleMaxTokensChange,
    handleTemperatureChange,
    handleApiKeyChange,
    handleQwenCodeOauthPathChange,
    buildSettings,
  } = useProviderSettings(initialSettings);

  // Sync system prompt, tools, and indexing with initial settings
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSystemPrompt(initialSettings.systemPrompt || '');
      setEnabledTools(initialSettings.enabledTools || getAllTools(true));
      setIndexingSettings(initialSettings.indexingSettings || DEFAULT_INDEXING_SETTINGS);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [initialSettings]);

  // Auto-save settings
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onSave({
        ...buildSettings(),
        systemPrompt,
        enabledTools,
        indexingSettings,
      });
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [provider, currentSettings, systemPrompt, enabledTools, indexingSettings, onSave, buildSettings]);

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
            backgroundColor: 'var(--vscode-editor-background)',
          }}
        >
          <h1
            className="text-sm sm:text-base font-semibold"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            {activeTab === 'api' ? 'API Configuration' : activeTab === 'system' ? 'System Prompt' : activeTab === 'tools' ? 'Tool Configuration' : 'Indexing / Code Search'}
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto py-4 sm:py-6 px-4 sm:px-5">
          {activeTab === 'api' && (
            <ApiConfigTab
              provider={provider}
              customBaseUrl={currentSettings.customUrl}
              apiKey={currentSettings.apiKey}
              qwenCodeOauthPath={currentSettings.qwenCodeOauthPath}
              maxTokens={currentSettings.maxTokens}
              temperature={currentSettings.temperature}
              onProviderChange={handleProviderChange}
              onCustomBaseUrlChange={handleCustomUrlChange}
              onApiKeyChange={handleApiKeyChange}
              onQwenCodeOauthPathChange={handleQwenCodeOauthPathChange}
              onMaxTokensChange={handleMaxTokensChange}
              onTemperatureChange={handleTemperatureChange}
            />
          )}

          {activeTab === 'system' && (
            <SystemPromptTab value={systemPrompt} onChange={setSystemPrompt} />
          )}

          {activeTab === 'tools' && (
            <ToolsTab enabledTools={enabledTools} onChange={setEnabledTools} />
          )}

          {activeTab === 'indexing' && (
            <IndexingTab indexingSettings={indexingSettings} onChange={setIndexingSettings} />
          )}
        </div>
      </div>
    </div>
  );
}