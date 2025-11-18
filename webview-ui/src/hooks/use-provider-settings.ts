import { useState, useEffect } from 'react';
import type { ApiSettings, Provider } from '../types/api-settings';

interface ProviderSettings {
  customUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export function useProviderSettings(initialSettings: ApiSettings) {
  const [provider, setProvider] = useState<Provider>(initialSettings.provider);
  
  // Provider-specific states
  const [anthropicCustomUrl, setAnthropicCustomUrl] = useState(initialSettings.anthropicCustomUrl || '');
  const [openaiCustomUrl, setOpenaiCustomUrl] = useState(initialSettings.openaiCustomUrl || '');
  const [openaiCompatibleCustomUrl, setOpenaiCompatibleCustomUrl] = useState(initialSettings.openaiCompatibleCustomUrl || '');
  
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

  const [model, setModel] = useState(initialSettings.model);

  // Get current settings based on provider
  const currentSettings: ProviderSettings = {
    customUrl: provider === 'anthropic' ? anthropicCustomUrl : provider === 'openai' ? openaiCustomUrl : openaiCompatibleCustomUrl,
    apiKey: provider === 'anthropic' ? anthropicApiKey : provider === 'openai' ? openaiApiKey : openaiCompatibleApiKey,
    model,
    maxTokens: provider === 'anthropic' ? anthropicMaxTokens : provider === 'openai' ? openaiMaxTokens : openaiCompatibleMaxTokens,
    temperature: provider === 'anthropic' ? anthropicTemperature : provider === 'openai' ? openaiTemperature : openaiCompatibleTemperature,
  };

  // Restore model when provider changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const savedModel = provider === 'anthropic' ? anthropicModel : provider === 'openai' ? openaiModel : openaiCompatibleModel;
      setModel(savedModel);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [provider, anthropicModel, openaiModel, openaiCompatibleModel]);

  // Sync with initial settings
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
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [initialSettings]);

  // Handler functions
  const handleProviderChange = (newProvider: Provider) => {
    if (provider === 'anthropic') {
      setAnthropicModel(model);
    } else if (provider === 'openai') {
      setOpenaiModel(model);
    } else {
      setOpenaiCompatibleModel(model);
    }
    setProvider(newProvider);
  };

  const handleCustomUrlChange = (value: string) => {
    if (provider === 'anthropic') {
      setAnthropicCustomUrl(value);
    } else if (provider === 'openai') {
      setOpenaiCustomUrl(value);
    } else {
      setOpenaiCompatibleCustomUrl(value);
    }
  };

  const handleMaxTokensChange = (value: number) => {
    if (provider === 'anthropic') {
      setAnthropicMaxTokens(value);
    } else if (provider === 'openai') {
      setOpenaiMaxTokens(value);
    } else {
      setOpenaiCompatibleMaxTokens(value);
    }
  };

  const handleTemperatureChange = (value: number) => {
    if (provider === 'anthropic') {
      setAnthropicTemperature(value);
    } else if (provider === 'openai') {
      setOpenaiTemperature(value);
    } else {
      setOpenaiCompatibleTemperature(value);
    }
  };

  const handleApiKeyChange = (value: string) => {
    if (provider === 'anthropic') {
      setAnthropicApiKey(value);
    } else if (provider === 'openai') {
      setOpenaiApiKey(value);
    } else {
      setOpenaiCompatibleApiKey(value);
    }
  };

  // Build complete settings object
  const buildSettings = (): ApiSettings => {
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
    
    return {
      provider,
      customBaseUrl: currentSettings.customUrl,
      anthropicCustomUrl,
      openaiCustomUrl,
      openaiCompatibleCustomUrl,
      model,
      anthropicModel: updatedAnthropicModel,
      openaiModel: updatedOpenaiModel,
      openaiCompatibleModel: updatedOpenaiCompatibleModel,
      apiKey: currentSettings.apiKey,
      anthropicApiKey,
      openaiApiKey,
      openaiCompatibleApiKey,
      anthropicMaxTokens,
      openaiMaxTokens,
      openaiCompatibleMaxTokens,
      anthropicTemperature,
      openaiTemperature,
      openaiCompatibleTemperature,
    };
  };

  return {
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
    allSettings: {
      anthropicCustomUrl,
      openaiCustomUrl,
      openaiCompatibleCustomUrl,
      anthropicModel,
      openaiModel,
      openaiCompatibleModel,
      anthropicApiKey,
      openaiApiKey,
      openaiCompatibleApiKey,
      anthropicMaxTokens,
      openaiMaxTokens,
      openaiCompatibleMaxTokens,
      anthropicTemperature,
      openaiTemperature,
      openaiCompatibleTemperature,
    },
  };
}
