import { useState, useEffect } from 'react';
import { SettingsSidebar } from '../ui/settings-sidebar';
import { SettingsDropdown } from '../ui/settings-dropdown';
import { ApiConfigTab } from './api-config-tab';
import { SystemPromptTab } from './system-prompt-tab';
import { useModelFetcher } from '../../hooks/use-model-fetcher';
import type { ApiSettings } from '../../types/api-settings';

interface SetupPageProps {
  initialSettings: ApiSettings;
  onSave: (settings: ApiSettings) => void;
  onClose?: () => void;
}

export function SetupPage({ initialSettings, onSave }: SetupPageProps) {
  const [baseUrl, setBaseUrl] = useState(initialSettings.baseUrl);
  const [model, setModel] = useState(initialSettings.model);
  const [apiKey, setApiKey] = useState(initialSettings.apiKey);
  const [maxTokens, setMaxTokens] = useState(initialSettings.maxTokens || 2048);
  const [systemPrompt, setSystemPrompt] = useState(initialSettings.systemPrompt || '');
  const [activeTab, setActiveTab] = useState<'api' | 'system'>('api');
  const [showDropdown, setShowDropdown] = useState(false);

  const { models, loadingModels } = useModelFetcher(baseUrl, apiKey);

  // Clear model when endpoint changes
  useEffect(() => {
    const timeoutId = setTimeout(() => setModel(''), 0);
    return () => clearTimeout(timeoutId);
  }, [baseUrl]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setBaseUrl(initialSettings.baseUrl);
      setModel(initialSettings.model);
      setApiKey(initialSettings.apiKey);
      setMaxTokens(initialSettings.maxTokens || 2048);
      setSystemPrompt(initialSettings.systemPrompt || '');
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [initialSettings]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onSave({ baseUrl, model, apiKey, maxTokens, systemPrompt });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [baseUrl, model, apiKey, maxTokens, systemPrompt, onSave]);


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
              baseUrl={baseUrl}
              apiKey={apiKey}
              model={model}
              maxTokens={maxTokens}
              models={models}
              loadingModels={loadingModels}
              onBaseUrlChange={setBaseUrl}
              onApiKeyChange={setApiKey}
              onModelChange={setModel}
              onMaxTokensChange={setMaxTokens}
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