import { useState, useEffect } from 'react';
import type { ApiSettings, Provider } from '../types/api-settings';

/**
 * Custom hook to manage setup form state and logic
 * Extracts state management from setup-page.tsx (SRP)
 */
export function useSetupForm(
  initialSettings: ApiSettings,
  onSave: (settings: ApiSettings) => void
) {
  const [provider, setProvider] = useState<Provider>(initialSettings.provider);
  const [anthropicCustomUrl, setAnthropicCustomUrl] = useState(initialSettings.anthropicCustomUrl || '');
  const [openaiCustomUrl, setOpenaiCustomUrl] = useState(initialSettings.openaiCustomUrl || '');
  const [openaiCompatibleCustomUrl, setOpenaiCompatibleCustomUrl] = useState(initialSettings.openaiCompatibleCustomUrl || '');
  const [model, setModel] = useState(initialSettings.model);
  const [anthropicModel, setAnthropicModel] = useState(initialSettings.anthropicModel || '');
  const [openaiModel, setOpenaiModel] = useState(initialSettings.openaiModel || '');
  const [openaiCompatibleModel, setOpenaiCompatibleModel] = useState(initialSettings.openaiCompatibleModel || '');
  const [vscodeLmModel, setVscodeLmModel] = useState(initialSettings.vscodeLmModel || '');
  const [qwenCodeModel, setQwenCodeModel] = useState(initialSettings.qwenCodeModel || '');
  const [apiKey, setApiKey] = useState(initialSettings.apiKey);
  const [anthropicApiKey, setAnthropicApiKey] = useState(initialSettings.anthropicApiKey || initialSettings.apiKey || '');
  const [openaiApiKey, setOpenaiApiKey] = useState(initialSettings.openaiApiKey || initialSettings.apiKey || '');
  const [openaiCompatibleApiKey, setOpenaiCompatibleApiKey] = useState(initialSettings.openaiCompatibleApiKey || initialSettings.apiKey || '');
  const [qwenCodeOauthPath, setQwenCodeOauthPath] = useState(initialSettings.qwenCodeOauthPath || '');
  const [anthropicMaxTokens, setAnthropicMaxTokens] = useState(initialSettings.anthropicMaxTokens);
  const [openaiMaxTokens, setOpenaiMaxTokens] = useState(initialSettings.openaiMaxTokens);
  const [openaiCompatibleMaxTokens, setOpenaiCompatibleMaxTokens] = useState(initialSettings.openaiCompatibleMaxTokens);
  const [vscodeLmMaxTokens, setVscodeLmMaxTokens] = useState(initialSettings.vscodeLmMaxTokens);
  const [qwenCodeMaxTokens, setQwenCodeMaxTokens] = useState(initialSettings.qwenCodeMaxTokens);
  const [anthropicTemperature, setAnthropicTemperature] = useState(initialSettings.anthropicTemperature);
  const [openaiTemperature, setOpenaiTemperature] = useState(initialSettings.openaiTemperature);
  const [openaiCompatibleTemperature, setOpenaiCompatibleTemperature] = useState(initialSettings.openaiCompatibleTemperature);
  const [vscodeLmTemperature, setVscodeLmTemperature] = useState(initialSettings.vscodeLmTemperature);
  const [qwenCodeTemperature, setQwenCodeTemperature] = useState(initialSettings.qwenCodeTemperature);
  const [systemPrompt, setSystemPrompt] = useState(initialSettings.systemPrompt || '');

  // Restore model when provider changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const savedModel = provider === 'anthropic' 
        ? anthropicModel 
        : provider === 'openai' 
        ? openaiModel 
        : provider === 'openai-compatible'
        ? openaiCompatibleModel
        : provider === 'qwen-code'
        ? qwenCodeModel
        : vscodeLmModel;
      setModel(savedModel);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [provider, anthropicModel, openaiModel, openaiCompatibleModel, qwenCodeModel, vscodeLmModel]);

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
      setApiKey(initialSettings.apiKey);
      setAnthropicApiKey(initialSettings.anthropicApiKey || initialSettings.apiKey || '');
      setOpenaiApiKey(initialSettings.openaiApiKey || initialSettings.apiKey || '');
      setOpenaiCompatibleApiKey(initialSettings.openaiCompatibleApiKey || initialSettings.apiKey || '');
      setQwenCodeOauthPath(initialSettings.qwenCodeOauthPath || '');
      setAnthropicMaxTokens(initialSettings.anthropicMaxTokens);
      setOpenaiMaxTokens(initialSettings.openaiMaxTokens);
      setOpenaiCompatibleMaxTokens(initialSettings.openaiCompatibleMaxTokens);
      setVscodeLmMaxTokens(initialSettings.vscodeLmMaxTokens);
      setQwenCodeMaxTokens(initialSettings.qwenCodeMaxTokens);
      setAnthropicTemperature(initialSettings.anthropicTemperature);
      setOpenaiTemperature(initialSettings.openaiTemperature);
      setOpenaiCompatibleTemperature(initialSettings.openaiCompatibleTemperature);
      setVscodeLmTemperature(initialSettings.vscodeLmTemperature);
      setQwenCodeTemperature(initialSettings.qwenCodeTemperature);
      setSystemPrompt(initialSettings.systemPrompt || '');
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [initialSettings]);

  // Auto-save with debounce
  useEffect(() => {
    const currentCustomUrl = provider === 'anthropic' 
      ? anthropicCustomUrl 
      : provider === 'openai' 
      ? openaiCustomUrl 
      : provider === 'openai-compatible'
      ? openaiCompatibleCustomUrl
      : '';
    
    const currentApiKey = provider === 'anthropic' 
      ? anthropicApiKey 
      : provider === 'openai' 
      ? openaiApiKey 
      : provider === 'openai-compatible'
      ? openaiCompatibleApiKey
      : '';
    
    // Update provider-specific model before saving
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
    
    const timeoutId = setTimeout(() => {
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
        vscodeLmModel: updatedVscodeLmModel,
        qwenCodeModel,
        apiKey: currentApiKey, 
        anthropicApiKey,
        openaiApiKey,
        openaiCompatibleApiKey,
        qwenCodeOauthPath,
        anthropicMaxTokens, 
        openaiMaxTokens, 
        openaiCompatibleMaxTokens,
        megallmMaxTokens: initialSettings.megallmMaxTokens,
        vscodeLmMaxTokens,
        qwenCodeMaxTokens,
        anthropicTemperature,
        openaiTemperature,
        openaiCompatibleTemperature,
        megallmTemperature: initialSettings.megallmTemperature,
        vscodeLmTemperature,
        qwenCodeTemperature,
        streamingTimeout: initialSettings.streamingTimeout,
        systemPrompt 
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [provider, anthropicCustomUrl, openaiCustomUrl, openaiCompatibleCustomUrl, model, anthropicModel, openaiModel, openaiCompatibleModel, vscodeLmModel, qwenCodeModel, apiKey, anthropicApiKey, openaiApiKey, openaiCompatibleApiKey, qwenCodeOauthPath, anthropicMaxTokens, openaiMaxTokens, openaiCompatibleMaxTokens, vscodeLmMaxTokens, qwenCodeMaxTokens, anthropicTemperature, openaiTemperature, openaiCompatibleTemperature, vscodeLmTemperature, qwenCodeTemperature, systemPrompt, onSave, initialSettings.megallmMaxTokens, initialSettings.megallmTemperature, initialSettings.streamingTimeout]);

  // Handle provider change with model persistence
  const handleProviderChange = (newProvider: Provider) => {
    // Save current model to provider-specific state
    if (provider === 'anthropic') {
      setAnthropicModel(model);
    } else if (provider === 'openai') {
      setOpenaiModel(model);
    } else if (provider === 'openai-compatible') {
      setOpenaiCompatibleModel(model);
    } else if (provider === 'vscode-lm') {
      setVscodeLmModel(model);
    } else if (provider === 'qwen-code') {
      setQwenCodeModel(model);
    }
    
    setProvider(newProvider);
  };

  return {
    provider,
    anthropicCustomUrl,
    openaiCustomUrl,
    openaiCompatibleCustomUrl,
    model,
    anthropicModel,
    openaiModel,
    openaiCompatibleModel,
    vscodeLmModel,
    apiKey,
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
    systemPrompt,
    setProvider: handleProviderChange,
    setAnthropicCustomUrl,
    setOpenaiCustomUrl,
    setOpenaiCompatibleCustomUrl,
    setModel,
    setApiKey,
    setAnthropicApiKey,
    setOpenaiApiKey,
    setOpenaiCompatibleApiKey,
    setAnthropicMaxTokens,
    setOpenaiMaxTokens,
    setOpenaiCompatibleMaxTokens,
    setVscodeLmMaxTokens,
    setAnthropicTemperature,
    setOpenaiTemperature,
    setOpenaiCompatibleTemperature,
    setVscodeLmTemperature,
    setSystemPrompt,
  };
}
