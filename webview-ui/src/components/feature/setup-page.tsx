import { useState, useEffect } from 'react';

import { SettingsSidebar } from '../ui/settings-sidebar';
import { SettingsDropdown } from '../ui/settings-dropdown';
import { ApiConfigTab } from './api-config-tab';
import { SystemPromptTab } from './system-prompt-tab';
import { ToolsTab } from './tools-tab';
import { IndexingTab } from './indexing-tab';
import { AutocompleteTab } from './autocomplete-tab';
import { ContextSettingsTab } from './context-settings-tab';

import { useProviderSettings } from '../../hooks/use-provider-settings';
import { getAllTools } from '../../lib/tool-config';
import type { ApiSettings, Tool, IndexingSettings, AutocompleteSettings, ContextSettings } from '../../types/api-settings';
import { DEFAULT_INDEXING_SETTINGS, DEFAULT_AUTOCOMPLETE_SETTINGS, DEFAULT_CONTEXT_SETTINGS } from '../../types/api-settings';

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
  const [autocompleteSettings, setAutocompleteSettings] = useState<AutocompleteSettings>(
    initialSettings.autocompleteSettings || DEFAULT_AUTOCOMPLETE_SETTINGS
  );
  const [contextSettings, setContextSettings] = useState<ContextSettings>(
    initialSettings.contextSettings || DEFAULT_CONTEXT_SETTINGS
  );
  const [activeTab, setActiveTab] = useState<'api' | 'system' | 'tools' | 'indexing' | 'autocomplete' | 'context'>('api');
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
    handleStreamingTimeoutChange,
    streamingTimeout,
    buildSettings,
  } = useProviderSettings(initialSettings);

  // Sync system prompt, tools, and indexing with initial settings
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSystemPrompt(initialSettings.systemPrompt || '');
      setEnabledTools(initialSettings.enabledTools || getAllTools(true));
      setIndexingSettings(initialSettings.indexingSettings || DEFAULT_INDEXING_SETTINGS);
      setAutocompleteSettings(initialSettings.autocompleteSettings || DEFAULT_AUTOCOMPLETE_SETTINGS);
      setContextSettings(initialSettings.contextSettings || DEFAULT_CONTEXT_SETTINGS);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [initialSettings]);

  // Immediate autocomplete settings update (no delay for responsive feel)
  useEffect(() => {
    // Skip initial mount
    if (autocompleteSettings === (initialSettings.autocompleteSettings || DEFAULT_AUTOCOMPLETE_SETTINGS)) {
      return;
    }
    // Send immediately for autocomplete changes
    onSave({
      ...buildSettings(),
      systemPrompt,
      enabledTools,
      indexingSettings,
      autocompleteSettings,
      contextSettings,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autocompleteSettings, contextSettings]);

  // Auto-save other settings with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onSave({
        ...buildSettings(),
        systemPrompt,
        enabledTools,
        indexingSettings,
        autocompleteSettings,
        contextSettings,
      });
    }, 500);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, currentSettings, systemPrompt, enabledTools, indexingSettings, contextSettings, streamingTimeout]);

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
            {activeTab === 'api' ? 'API Configuration' : activeTab === 'system' ? 'System Prompt' : activeTab === 'tools' ? 'Tool Configuration' : activeTab === 'indexing' ? 'Indexing / Code Search' : activeTab === 'autocomplete' ? 'Autocomplete' : activeTab === 'context' ? 'Context Management' : ''}
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
              streamingTimeout={streamingTimeout}
              onProviderChange={handleProviderChange}
              onCustomBaseUrlChange={handleCustomUrlChange}
              onApiKeyChange={handleApiKeyChange}
              onQwenCodeOauthPathChange={handleQwenCodeOauthPathChange}
              onMaxTokensChange={handleMaxTokensChange}
              onTemperatureChange={handleTemperatureChange}
              onStreamingTimeoutChange={handleStreamingTimeoutChange}
            />
          )}

          {activeTab === 'system' && (
            <SystemPromptTab value={systemPrompt} onChange={setSystemPrompt} />
          )}

          {activeTab === 'tools' && (
            <ToolsTab enabledTools={enabledTools} onChange={setEnabledTools} />
          )}

          {activeTab === 'indexing' && (
            <IndexingTab
              indexingSettings={indexingSettings}
              onChange={setIndexingSettings}
            />
          )}

          {activeTab === 'autocomplete' && (
            <AutocompleteTab
              autocompleteSettings={autocompleteSettings}
              onChange={setAutocompleteSettings}
            />
          )}

          {activeTab === 'context' && (
            <ContextSettingsTab
              contextSettings={contextSettings}
              onChange={setContextSettings}
            />
          )}
        </div>
      </div>
    </div>
  );
}