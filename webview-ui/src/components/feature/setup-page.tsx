import { useState, useEffect } from 'react';
import { SettingsSidebar } from '../ui/settings-sidebar';
import { SettingsDropdown } from '../ui/settings-dropdown';
import { ApiConfigTab } from './api-config-tab';
import { SystemPromptTab } from './system-prompt-tab';
import { useModelFetcher } from '../../hooks/use-model-fetcher';
import type { ApiSettings, Provider } from '../../types/api-settings';

interface SetupPageProps {
  initialSettings: ApiSettings;
  onSave: (settings: ApiSettings) => void;
  onClose?: () => void;
}

export function SetupPage({ initialSettings, onSave }: SetupPageProps) {
  const [provider, setProvider] = useState<Provider>(initialSettings.provider);
  const [anthropicCustomUrl, setAnthropicCustomUrl] = useState(initialSettings.anthropicCustomUrl || '');
  const [openaiCustomUrl, setOpenaiCustomUrl] = useState(initialSettings.openaiCustomUrl || '');
  const [openaiCompatibleCustomUrl, setOpenaiCompatibleCustomUrl] = useState(initialSettings.openaiCompatibleCustomUrl || '');
  const [model, setModel] = useState(initialSettings.model);
  const [anthropicModel, setAnthropicModel] = useState(initialSettings.anthropicModel || '');
  const [openaiModel, setOpenaiModel] = useState(initialSettings.openaiModel || '');
  const [openaiCompatibleModel, setOpenaiCompatibleModel] = useState(initialSettings.openaiCompatibleModel || '');
  const [anthropicApiKey, setAnthropicApiKey] = useState(initialSettings.anthropicApiKey || initialSettings.apiKey || '');
  const [openaiApiKey, setOpenaiApiKey] = useState(initialSettings.openaiApiKey || initialSettings.apiKey || '');
  const [openaiCompatibleApiKey, setOpenaiCompatibleApiKey] = useState(initialSettings.openaiCompatibleApiKey || initialSettings.apiKey || '');
  const [anthropicMaxTokens, setAnthropicMaxTokens] = useState(initialSettings.anthropicMaxTokens);
  const [openaiMaxTokens, setOpenaiMaxTokens] = useState(initialSettings.openaiMaxTokens);
  const [openaiCompatibleMaxTokens, setOpenaiCompatibleMaxTokens] = useState(initialSettings.openaiCompatibleMaxTokens);
  const [anthropicTemperature, setAnthropicTemperature] = useState(initialSettings.anthropicTemperature);
  const [openaiTemperature, setOpenaiTemperature] = useState(initialSettings.openaiTemperature);
  const [openaiCompatibleTemperature, setOpenaiCompatibleTemperature] = useState(initialSettings.openaiCompatibleTemperature);
  const [systemPrompt, setSystemPrompt] = useState(initialSettings.systemPrompt || '');
  const [activeTab, setActiveTab] = useState<'api' | 'system'>('api');
  const [showDropdown, setShowDropdown] = useState(false);

  // Get current custom URL and max tokens based on provider
  const currentCustomUrl = provider === 'anthropic' 
    ? anthropicCustomUrl 
    : provider === 'openai' 
    ? openaiCustomUrl 
    : openaiCompatibleCustomUrl;
  const currentMaxTokens = provider === 'anthropic' 
    ? anthropicMaxTokens 
    : provider === 'openai' 
    ? openaiMaxTokens 
    : openaiCompatibleMaxTokens;
  const currentTemperature = provider === 'anthropic' 
    ? anthropicTemperature 
    : provider === 'openai' 
    ? openaiTemperature 
    : openaiCompatibleTemperature;
  const currentApiKey = provider === 'anthropic' 
    ? anthropicApiKey 
    : provider === 'openai' 
    ? openaiApiKey 
    : openaiCompatibleApiKey;

  const { models, loadingModels, fetchModels, refetchModels, clearCache } = useModelFetcher(provider, currentCustomUrl, currentApiKey);

  // Clear cache and restore model when provider changes
  useEffect(() => {
    clearCache();
    const timeoutId = setTimeout(() => {
      const savedModel = provider === 'anthropic' 
        ? anthropicModel 
        : provider === 'openai' 
        ? openaiModel 
        : openaiCompatibleModel;
      setModel(savedModel);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [provider, anthropicModel, openaiModel, openaiCompatibleModel, clearCache]);

  // Clear cache and fetch models when customUrl changes
  useEffect(() => {
    clearCache();
    // Fetch models if we have an API key
    if (currentApiKey) {
      const timeoutId = setTimeout(() => {
        fetchModels(true);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [currentCustomUrl, currentApiKey, clearCache, fetchModels]);

  // Clear model if it's not in the fetched models list
  useEffect(() => {
    if (model && models.length > 0 && !models.includes(model)) {
      setTimeout(() => setModel(''), 0);
    }
  }, [models, model]);

  // Handle provider change
  const handleProviderChange = (newProvider: Provider) => {
    // Save current model to provider-specific state
    if (provider === 'anthropic') {
      setAnthropicModel(model);
    } else if (provider === 'openai') {
      setOpenaiModel(model);
    } else {
      setOpenaiCompatibleModel(model);
    }
    
    setProvider(newProvider);
  };

  // Handle custom URL change based on current provider
  const handleCustomUrlChange = (value: string) => {
    if (provider === 'anthropic') {
      setAnthropicCustomUrl(value);
    } else if (provider === 'openai') {
      setOpenaiCustomUrl(value);
    } else {
      setOpenaiCompatibleCustomUrl(value);
    }
  };

  // Handle max tokens change based on current provider
  const handleMaxTokensChange = (value: number) => {
    if (provider === 'anthropic') {
      setAnthropicMaxTokens(value);
    } else if (provider === 'openai') {
      setOpenaiMaxTokens(value);
    } else {
      setOpenaiCompatibleMaxTokens(value);
    }
  };

  // Handle temperature change based on current provider
  const handleTemperatureChange = (value: number) => {
    if (provider === 'anthropic') {
      setAnthropicTemperature(value);
    } else if (provider === 'openai') {
      setOpenaiTemperature(value);
    } else {
      setOpenaiCompatibleTemperature(value);
    }
  };

  // Handle API key change based on current provider
  const handleApiKeyChange = (value: string) => {
    if (provider === 'anthropic') {
      setAnthropicApiKey(value);
    } else if (provider === 'openai') {
      setOpenaiApiKey(value);
    } else {
      setOpenaiCompatibleApiKey(value);
    }
  };

  // Handle model dropdown open - fetch models lazily
  const handleModelDropdownOpen = () => {
    // Fetch if we have an API key
    if (currentApiKey) {
      fetchModels();
    }
  };

  // Handle refresh models - force refetch
  const handleRefreshModels = () => {
    refetchModels();
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setProvider(initialSettings.provider);
      setAnthropicCustomUrl(initialSettings.anthropicCustomUrl || '');
      setOpenaiCustomUrl(initialSettings.openaiCustomUrl || '');
      setOpenaiCompatibleCustomUrl(initialSettings.openaiCompatibleCustomUrl || '');
      setModel(initialSettings.model);
      setAnthropicModel(initialSettings.anthropicModel || '');
      setOpenaiModel(initialSettings.openaiModel || '');
      setOpenaiCompatibleModel(initialSettings.openaiCompatibleModel || '');
      setAnthropicApiKey(initialSettings.anthropicApiKey || initialSettings.apiKey || '');
      setOpenaiApiKey(initialSettings.openaiApiKey || initialSettings.apiKey || '');
      setOpenaiCompatibleApiKey(initialSettings.openaiCompatibleApiKey || initialSettings.apiKey || '');
      setAnthropicMaxTokens(initialSettings.anthropicMaxTokens);
      setOpenaiMaxTokens(initialSettings.openaiMaxTokens);
      setOpenaiCompatibleMaxTokens(initialSettings.openaiCompatibleMaxTokens);
      setAnthropicTemperature(initialSettings.anthropicTemperature);
      setOpenaiTemperature(initialSettings.openaiTemperature);
      setOpenaiCompatibleTemperature(initialSettings.openaiCompatibleTemperature);
      setSystemPrompt(initialSettings.systemPrompt || '');
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [initialSettings]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Update provider-specific model before saving
      let updatedAnthropicModel = anthropicModel;
      let updatedOpenaiModel = openaiModel;
      let updatedOpenaiCompatibleModel = openaiCompatibleModel;
      
      if (provider === 'anthropic') {
        updatedAnthropicModel = model;
      } else if (provider === 'openai') {
        updatedOpenaiModel = model;
      } else {
        updatedOpenaiCompatibleModel = model;
      }
      
      onSave({ 
        provider,
        customBaseUrl: currentCustomUrl, // For backward compatibility
        anthropicCustomUrl,
        openaiCustomUrl,
        openaiCompatibleCustomUrl,
        model, 
        anthropicModel: updatedAnthropicModel,
        openaiModel: updatedOpenaiModel,
        openaiCompatibleModel: updatedOpenaiCompatibleModel,
        apiKey: currentApiKey, 
        anthropicApiKey,
        openaiApiKey,
        openaiCompatibleApiKey,
        anthropicMaxTokens, 
        openaiMaxTokens, 
        openaiCompatibleMaxTokens,
        anthropicTemperature,
        openaiTemperature,
        openaiCompatibleTemperature,
        systemPrompt 
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [provider, anthropicCustomUrl, openaiCustomUrl, openaiCompatibleCustomUrl, currentCustomUrl, model, anthropicModel, openaiModel, openaiCompatibleModel, currentApiKey, anthropicApiKey, openaiApiKey, openaiCompatibleApiKey, anthropicMaxTokens, openaiMaxTokens, openaiCompatibleMaxTokens, anthropicTemperature, openaiTemperature, openaiCompatibleTemperature, systemPrompt, onSave]);

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
              customBaseUrl={currentCustomUrl}
              apiKey={currentApiKey}
              model={model}
              maxTokens={currentMaxTokens}
              temperature={currentTemperature}
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