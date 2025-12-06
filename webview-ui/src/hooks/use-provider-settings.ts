import { useState, useEffect } from 'react';
import type { ApiSettings, Provider } from '../types/api-settings';
import { storageService } from '../utils/storage';

interface ProviderSettings {
  customUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  qwenCodeOauthPath?: string;
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
  const [qwenCodeModel, setQwenCodeModel] = useState(initialSettings.qwenCodeModel || '');
  
  const [anthropicApiKey, setAnthropicApiKey] = useState(initialSettings.anthropicApiKey || '');
  const [openaiApiKey, setOpenaiApiKey] = useState(initialSettings.openaiApiKey || '');
  const [openaiCompatibleApiKey, setOpenaiCompatibleApiKey] = useState(initialSettings.openaiCompatibleApiKey || '');
  const [megallmApiKey, setMegallmApiKey] = useState(initialSettings.megallmApiKey || '');
  
  const [anthropicMaxTokens, setAnthropicMaxTokens] = useState(initialSettings.anthropicMaxTokens);
  const [openaiMaxTokens, setOpenaiMaxTokens] = useState(initialSettings.openaiMaxTokens);
  const [openaiCompatibleMaxTokens, setOpenaiCompatibleMaxTokens] = useState(initialSettings.openaiCompatibleMaxTokens);
  const [vscodeLmMaxTokens, setVscodeLmMaxTokens] = useState(initialSettings.vscodeLmMaxTokens);
  const [qwenCodeMaxTokens, setQwenCodeMaxTokens] = useState(initialSettings.qwenCodeMaxTokens);
  const [megallmMaxTokens, setMegallmMaxTokens] = useState(initialSettings.megallmMaxTokens);
  
  const [anthropicTemperature, setAnthropicTemperature] = useState(initialSettings.anthropicTemperature);
  const [openaiTemperature, setOpenaiTemperature] = useState(initialSettings.openaiTemperature);
  const [openaiCompatibleTemperature, setOpenaiCompatibleTemperature] = useState(initialSettings.openaiCompatibleTemperature);
  const [vscodeLmTemperature, setVscodeLmTemperature] = useState(initialSettings.vscodeLmTemperature);
  const [qwenCodeTemperature, setQwenCodeTemperature] = useState(initialSettings.qwenCodeTemperature);
  const [megallmTemperature, setMegallmTemperature] = useState(initialSettings.megallmTemperature);
  
  const [qwenCodeOauthPath, setQwenCodeOauthPath] = useState(initialSettings.qwenCodeOauthPath || '');
  const [streamingTimeout, setStreamingTimeout] = useState(initialSettings.streamingTimeout || 10000);

  const [model, setModel] = useState(initialSettings.model);

  // Get current settings based on provider
  const currentSettings: ProviderSettings = {
    customUrl: provider === 'anthropic'
      ? anthropicCustomUrl
      : provider === 'openai'
      ? openaiCustomUrl
      : provider === 'openai-compatible'
      ? openaiCompatibleCustomUrl
      : '',
    apiKey: provider === 'anthropic'
      ? anthropicApiKey
      : provider === 'openai'
      ? openaiApiKey
      : provider === 'openai-compatible'
      ? openaiCompatibleApiKey
      : provider === 'megallm'
      ? megallmApiKey
      : '',
    model,
    maxTokens: provider === 'anthropic'
      ? anthropicMaxTokens
      : provider === 'openai'
      ? openaiMaxTokens
      : provider === 'openai-compatible'
      ? openaiCompatibleMaxTokens
      : provider === 'megallm'
      ? megallmMaxTokens
      : provider === 'qwen-code'
      ? qwenCodeMaxTokens
      : vscodeLmMaxTokens,
    temperature: provider === 'anthropic'
      ? anthropicTemperature
      : provider === 'openai'
      ? openaiTemperature
      : provider === 'openai-compatible'
      ? openaiCompatibleTemperature
      : provider === 'megallm'
      ? megallmTemperature
      : provider === 'qwen-code'
      ? qwenCodeTemperature
      : vscodeLmTemperature,
    qwenCodeOauthPath: provider === 'qwen-code' ? qwenCodeOauthPath : undefined,
  };

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
      setQwenCodeModel(initialSettings.qwenCodeModel || '');
      setAnthropicApiKey(initialSettings.anthropicApiKey || '');
      setOpenaiApiKey(initialSettings.openaiApiKey || '');
      setOpenaiCompatibleApiKey(initialSettings.openaiCompatibleApiKey || '');
      setMegallmApiKey(initialSettings.megallmApiKey || '');
      setAnthropicMaxTokens(initialSettings.anthropicMaxTokens);
      setOpenaiMaxTokens(initialSettings.openaiMaxTokens);
      setOpenaiCompatibleMaxTokens(initialSettings.openaiCompatibleMaxTokens);
      setVscodeLmMaxTokens(initialSettings.vscodeLmMaxTokens);
      setQwenCodeMaxTokens(initialSettings.qwenCodeMaxTokens);
      setMegallmMaxTokens(initialSettings.megallmMaxTokens);
      setAnthropicTemperature(initialSettings.anthropicTemperature);
      setOpenaiTemperature(initialSettings.openaiTemperature);
      setOpenaiCompatibleTemperature(initialSettings.openaiCompatibleTemperature);
      setVscodeLmTemperature(initialSettings.vscodeLmTemperature);
      setQwenCodeTemperature(initialSettings.qwenCodeTemperature);
      setMegallmTemperature(initialSettings.megallmTemperature);
      setQwenCodeOauthPath(initialSettings.qwenCodeOauthPath || '');
      setStreamingTimeout(initialSettings.streamingTimeout || 10000);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [initialSettings]);

  // Handler functions
  const handleProviderChange = (newProvider: Provider) => {
    // Save current model to current provider-specific state
    // We need to track the current model value before state updates
    const currentModel = model;
    
    if (provider === 'anthropic') {
      setAnthropicModel(currentModel);
    } else if (provider === 'openai') {
      setOpenaiModel(currentModel);
    } else if (provider === 'openai-compatible') {
      setOpenaiCompatibleModel(currentModel);
    } else if (provider === 'vscode-lm') {
      setVscodeLmModel(currentModel);
    } else if (provider === 'qwen-code') {
      setQwenCodeModel(currentModel);
    }
    
    // Determine the saved model for the new provider BEFORE any state updates
    // Use current state values since React batches updates
    let savedModelForNewProvider = '';
    if (newProvider === 'anthropic') {
      savedModelForNewProvider = anthropicModel;
    } else if (newProvider === 'openai') {
      savedModelForNewProvider = openaiModel;
    } else if (newProvider === 'openai-compatible') {
      savedModelForNewProvider = openaiCompatibleModel;
    } else if (newProvider === 'vscode-lm') {
      savedModelForNewProvider = vscodeLmModel;
    } else if (newProvider === 'qwen-code') {
      savedModelForNewProvider = qwenCodeModel;
    }
    
    // Switch to new provider
    setProvider(newProvider);
    
    // Restore the saved model for the new provider
    setModel(savedModelForNewProvider);
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
    } else if (provider === 'qwen-code') {
      setQwenCodeMaxTokens(value);
    } else if (provider === 'megallm') {
      setMegallmMaxTokens(value);
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
    } else if (provider === 'qwen-code') {
      setQwenCodeTemperature(value);
    } else if (provider === 'megallm') {
      setMegallmTemperature(value);
    }
  };

  const handleApiKeyChange = (value: string) => {
    if (provider === 'anthropic') {
      setAnthropicApiKey(value);
    } else if (provider === 'openai') {
      setOpenaiApiKey(value);
    } else if (provider === 'megallm') {
      setMegallmApiKey(value);
    } else {
      setOpenaiCompatibleApiKey(value);
    }
  };

  const handleQwenCodeOauthPathChange = (value: string) => {
    setQwenCodeOauthPath(value);
  };

  const handleStreamingTimeoutChange = (value: number) => {
    setStreamingTimeout(value);
  };

  // Build complete settings object
  const buildSettings = (): ApiSettings => {
    const persisted = storageService.getSettings();

    return {
      provider,
      customBaseUrl: currentSettings.customUrl,
      anthropicCustomUrl,
      openaiCustomUrl,
      openaiCompatibleCustomUrl,
      // Preserve existing model selection; settings page does not manage models
      model: persisted.model,
      anthropicModel: persisted.anthropicModel,
      openaiModel: persisted.openaiModel,
      openaiCompatibleModel: persisted.openaiCompatibleModel,
      vscodeLmModel: persisted.vscodeLmModel,
      qwenCodeModel: persisted.qwenCodeModel,
      // Generic apiKey mirrors active provider-specific key (VS Code LM uses empty string)
      apiKey: currentSettings.apiKey,
      anthropicApiKey,
      openaiApiKey,
      openaiCompatibleApiKey,
      megallmApiKey,
      qwenCodeOauthPath,
      anthropicMaxTokens,
      openaiMaxTokens,
      openaiCompatibleMaxTokens,
      megallmMaxTokens,
      vscodeLmMaxTokens,
      qwenCodeMaxTokens,
      anthropicTemperature,
      openaiTemperature,
      openaiCompatibleTemperature,
      megallmTemperature,
      vscodeLmTemperature,
      qwenCodeTemperature,
      streamingTimeout,
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
    handleQwenCodeOauthPathChange,
    handleStreamingTimeoutChange,
    streamingTimeout,
    buildSettings,
    allSettings: {
      anthropicCustomUrl,
      openaiCustomUrl,
      openaiCompatibleCustomUrl,
      anthropicModel,
      openaiModel,
      openaiCompatibleModel,
      vscodeLmModel,
      qwenCodeModel,
      anthropicApiKey,
      openaiApiKey,
      openaiCompatibleApiKey,
      qwenCodeOauthPath,
      anthropicMaxTokens,
      openaiMaxTokens,
      openaiCompatibleMaxTokens,
      vscodeLmMaxTokens,
      qwenCodeMaxTokens,
      anthropicTemperature,
      openaiTemperature,
      openaiCompatibleTemperature,
      vscodeLmTemperature,
      qwenCodeTemperature,
    },
  };
}
