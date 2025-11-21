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
  const [vscodeLmModel, setVscodeLmModel] = useState(initialSettings.vscodeLmModel || '');
  
  const [anthropicApiKey, setAnthropicApiKey] = useState(initialSettings.anthropicApiKey || initialSettings.apiKey || '');
  const [openaiApiKey, setOpenaiApiKey] = useState(initialSettings.openaiApiKey || initialSettings.apiKey || '');
  const [openaiCompatibleApiKey, setOpenaiCompatibleApiKey] = useState(initialSettings.openaiCompatibleApiKey || initialSettings.apiKey || '');
  
  const [anthropicMaxTokens, setAnthropicMaxTokens] = useState(initialSettings.anthropicMaxTokens);
  const [openaiMaxTokens, setOpenaiMaxTokens] = useState(initialSettings.openaiMaxTokens);
  const [openaiCompatibleMaxTokens, setOpenaiCompatibleMaxTokens] = useState(initialSettings.openaiCompatibleMaxTokens);
  const [vscodeLmMaxTokens, setVscodeLmMaxTokens] = useState(initialSettings.vscodeLmMaxTokens);
  
  const [anthropicTemperature, setAnthropicTemperature] = useState(initialSettings.anthropicTemperature);
  const [openaiTemperature, setOpenaiTemperature] = useState(initialSettings.openaiTemperature);
  const [openaiCompatibleTemperature, setOpenaiCompatibleTemperature] = useState(initialSettings.openaiCompatibleTemperature);
  const [vscodeLmTemperature, setVscodeLmTemperature] = useState(initialSettings.vscodeLmTemperature);

  const [model, setModel] = useState(initialSettings.model);

  // Get current settings based on provider
  const currentSettings: ProviderSettings = {
    customUrl: provider === 'anthropic' ? anthropicCustomUrl : provider === 'openai' ? openaiCustomUrl : provider === 'openai-compatible' ? openaiCompatibleCustomUrl : '',
    apiKey: provider === 'anthropic' ? anthropicApiKey : provider === 'openai' ? openaiApiKey : provider === 'openai-compatible' ? openaiCompatibleApiKey : '',
    model,
    maxTokens: provider === 'anthropic' ? anthropicMaxTokens : provider === 'openai' ? openaiMaxTokens : provider === 'openai-compatible' ? openaiCompatibleMaxTokens : vscodeLmMaxTokens,
    temperature: provider === 'anthropic' ? anthropicTemperature : provider === 'openai' ? openaiTemperature : provider === 'openai-compatible' ? openaiCompatibleTemperature : vscodeLmTemperature,
  };

  // Restore model when provider changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const savedModel = provider === 'anthropic' ? anthropicModel : provider === 'openai' ? openaiModel : provider === 'openai-compatible' ? openaiCompatibleModel : vscodeLmModel;
      setModel(savedModel);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [provider, anthropicModel, openaiModel, openaiCompatibleModel, vscodeLmModel]);

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
      setVscodeLmModel(initialSettings.vscodeLmModel || '');
      setAnthropicApiKey(initialSettings.anthropicApiKey || initialSettings.apiKey || '');
      setOpenaiApiKey(initialSettings.openaiApiKey || initialSettings.apiKey || '');
      setOpenaiCompatibleApiKey(initialSettings.openaiCompatibleApiKey || initialSettings.apiKey || '');
      setAnthropicMaxTokens(initialSettings.anthropicMaxTokens);
      setOpenaiMaxTokens(initialSettings.openaiMaxTokens);
      setOpenaiCompatibleMaxTokens(initialSettings.openaiCompatibleMaxTokens);
      setVscodeLmMaxTokens(initialSettings.vscodeLmMaxTokens);
      setAnthropicTemperature(initialSettings.anthropicTemperature);
      setOpenaiTemperature(initialSettings.openaiTemperature);
      setOpenaiCompatibleTemperature(initialSettings.openaiCompatibleTemperature);
      setVscodeLmTemperature(initialSettings.vscodeLmTemperature);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [initialSettings]);

  // Handler functions
  const handleProviderChange = (newProvider: Provider) => {
    if (provider === 'anthropic') {
      setAnthropicModel(model);
    } else if (provider === 'openai') {
      setOpenaiModel(model);
    } else if (provider === 'openai-compatible') {
      setOpenaiCompatibleModel(model);
    } else if (provider === 'vscode-lm') {
      setVscodeLmModel(model);
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
    } else if (provider === 'openai-compatible') {
      setOpenaiCompatibleMaxTokens(value);
    } else if (provider === 'vscode-lm') {
      setVscodeLmMaxTokens(value);
    }
  };

  const handleTemperatureChange = (value: number) => {
    if (provider === 'anthropic') {
      setAnthropicTemperature(value);
    } else if (provider === 'openai') {
      setOpenaiTemperature(value);
    } else if (provider === 'openai-compatible') {
      setOpenaiCompatibleTemperature(value);
    } else if (provider === 'vscode-lm') {
      setVscodeLmTemperature(value);
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
    let updatedVscodeLmModel = vscodeLmModel;
    
    if (provider === 'anthropic') {
      updatedAnthropicModel = model;
    } else if (provider === 'openai') {
      updatedOpenaiModel = model;
    } else if (provider === 'openai-compatible') {
      updatedOpenaiCompatibleModel = model;
    } else if (provider === 'vscode-lm') {
      updatedVscodeLmModel = model;
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
      vscodeLmModel: updatedVscodeLmModel,
      apiKey: currentSettings.apiKey,
      anthropicApiKey,
      openaiApiKey,
      openaiCompatibleApiKey,
      anthropicMaxTokens,
      openaiMaxTokens,
      openaiCompatibleMaxTokens,
      vscodeLmMaxTokens,
      anthropicTemperature,
      openaiTemperature,
      openaiCompatibleTemperature,
      vscodeLmTemperature,
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
      vscodeLmModel,
      anthropicApiKey,
      openaiApiKey,
      openaiCompatibleApiKey,
      anthropicMaxTokens,
      openaiMaxTokens,
      openaiCompatibleMaxTokens,
      vscodeLmMaxTokens,
      anthropicTemperature,
      openaiTemperature,
      openaiCompatibleTemperature,
      vscodeLmTemperature,
    },
  };
}
