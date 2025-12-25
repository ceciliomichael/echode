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
  const [zaiCustomUrl, setZaiCustomUrl] = useState(initialSettings.zaiCustomUrl || '');
  const [model, setModel] = useState(initialSettings.model);
  const [anthropicModel, setAnthropicModel] = useState(initialSettings.anthropicModel || '');
  const [openaiModel, setOpenaiModel] = useState(initialSettings.openaiModel || '');
  const [openaiCompatibleModel, setOpenaiCompatibleModel] = useState(initialSettings.openaiCompatibleModel || '');
  const [vscodeLmModel, setVscodeLmModel] = useState(initialSettings.vscodeLmModel || '');
  const [qwenCodeModel, setQwenCodeModel] = useState(initialSettings.qwenCodeModel || '');
  const [zaiModel, setZaiModel] = useState(initialSettings.zaiModel || '');
  const [apiKey, setApiKey] = useState(initialSettings.apiKey);
  const [anthropicApiKey, setAnthropicApiKey] = useState(initialSettings.anthropicApiKey || '');
  const [openaiApiKey, setOpenaiApiKey] = useState(initialSettings.openaiApiKey || '');
  const [openaiCompatibleApiKey, setOpenaiCompatibleApiKey] = useState(initialSettings.openaiCompatibleApiKey || '');
  const [zaiApiKey, setZaiApiKey] = useState(initialSettings.zaiApiKey || '');
  const [qwenCodeOauthPath, setQwenCodeOauthPath] = useState(initialSettings.qwenCodeOauthPath || '');
  const [anthropicMaxTokens, setAnthropicMaxTokens] = useState(initialSettings.anthropicMaxTokens);
  const [openaiMaxTokens, setOpenaiMaxTokens] = useState(initialSettings.openaiMaxTokens);
  const [openaiCompatibleMaxTokens, setOpenaiCompatibleMaxTokens] = useState(initialSettings.openaiCompatibleMaxTokens);
  const [vscodeLmMaxTokens, setVscodeLmMaxTokens] = useState(initialSettings.vscodeLmMaxTokens);
  const [qwenCodeMaxTokens, setQwenCodeMaxTokens] = useState(initialSettings.qwenCodeMaxTokens);
  const [zaiMaxTokens, setZaiMaxTokens] = useState(initialSettings.zaiMaxTokens);
  const [anthropicTemperature, setAnthropicTemperature] = useState(initialSettings.anthropicTemperature);
  const [openaiTemperature, setOpenaiTemperature] = useState(initialSettings.openaiTemperature);
  const [openaiCompatibleTemperature, setOpenaiCompatibleTemperature] = useState(initialSettings.openaiCompatibleTemperature);
  const [vscodeLmTemperature, setVscodeLmTemperature] = useState(initialSettings.vscodeLmTemperature);
  const [qwenCodeTemperature, setQwenCodeTemperature] = useState(initialSettings.qwenCodeTemperature);
  const [zaiTemperature, setZaiTemperature] = useState(initialSettings.zaiTemperature);
  const [zaiThinking, setZaiThinking] = useState(initialSettings.zaiThinking ?? false);
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
        : provider === 'zai'
        ? zaiModel
        : vscodeLmModel;
      setModel(savedModel);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [provider, anthropicModel, openaiModel, openaiCompatibleModel, qwenCodeModel, vscodeLmModel, zaiModel]);

  // Sync with initial settings
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setProvider(initialSettings.provider);
      setAnthropicCustomUrl(initialSettings.anthropicCustomUrl || '');
      setOpenaiCustomUrl(initialSettings.openaiCustomUrl || '');
      setOpenaiCompatibleCustomUrl(initialSettings.openaiCompatibleCustomUrl || '');
      setZaiCustomUrl(initialSettings.zaiCustomUrl || '');
      setModel(initialSettings.model);
      setAnthropicModel(initialSettings.anthropicModel || '');
      setOpenaiModel(initialSettings.openaiModel || '');
      setOpenaiCompatibleModel(initialSettings.openaiCompatibleModel || '');
      setVscodeLmModel(initialSettings.vscodeLmModel || '');
      setQwenCodeModel(initialSettings.qwenCodeModel || '');
      setZaiModel(initialSettings.zaiModel || '');
      setApiKey(initialSettings.apiKey);
      setAnthropicApiKey(initialSettings.anthropicApiKey || '');
      setOpenaiApiKey(initialSettings.openaiApiKey || '');
      setOpenaiCompatibleApiKey(initialSettings.openaiCompatibleApiKey || '');
      setZaiApiKey(initialSettings.zaiApiKey || '');
      setQwenCodeOauthPath(initialSettings.qwenCodeOauthPath || '');
      setAnthropicMaxTokens(initialSettings.anthropicMaxTokens);
      setOpenaiMaxTokens(initialSettings.openaiMaxTokens);
      setOpenaiCompatibleMaxTokens(initialSettings.openaiCompatibleMaxTokens);
      setVscodeLmMaxTokens(initialSettings.vscodeLmMaxTokens);
      setQwenCodeMaxTokens(initialSettings.qwenCodeMaxTokens);
      setZaiMaxTokens(initialSettings.zaiMaxTokens);
      setAnthropicTemperature(initialSettings.anthropicTemperature);
      setOpenaiTemperature(initialSettings.openaiTemperature);
      setOpenaiCompatibleTemperature(initialSettings.openaiCompatibleTemperature);
      setVscodeLmTemperature(initialSettings.vscodeLmTemperature);
      setQwenCodeTemperature(initialSettings.qwenCodeTemperature);
      setZaiTemperature(initialSettings.zaiTemperature);
      setZaiThinking(initialSettings.zaiThinking ?? false);
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
      : provider === 'zai'
      ? zaiCustomUrl
      : '';
    
    const currentApiKey = provider === 'anthropic' 
      ? anthropicApiKey 
      : provider === 'openai' 
      ? openaiApiKey 
      : provider === 'openai-compatible'
      ? openaiCompatibleApiKey
      : provider === 'zai'
      ? zaiApiKey
      : '';
    
    // Update provider-specific model before saving
    let updatedAnthropicModel = anthropicModel;
    let updatedOpenaiModel = openaiModel;
    let updatedOpenaiCompatibleModel = openaiCompatibleModel;
    let updatedVscodeLmModel = vscodeLmModel;
    let updatedZaiModel = zaiModel;
    
    if (provider === 'anthropic') {
      updatedAnthropicModel = model;
    } else if (provider === 'openai') {
      updatedOpenaiModel = model;
    } else if (provider === 'openai-compatible') {
      updatedOpenaiCompatibleModel = model;
    } else if (provider === 'vscode-lm') {
      updatedVscodeLmModel = model;
    } else if (provider === 'zai') {
      updatedZaiModel = model;
    }
    
    const timeoutId = setTimeout(() => {
      onSave({ 
        provider,
        customBaseUrl: currentCustomUrl, // For backward compatibility
        anthropicCustomUrl,
        openaiCustomUrl,
        openaiCompatibleCustomUrl,
        zaiCustomUrl,
        model, 
        anthropicModel: updatedAnthropicModel,
        openaiModel: updatedOpenaiModel,
        openaiCompatibleModel: updatedOpenaiCompatibleModel,
        vscodeLmModel: updatedVscodeLmModel,
        qwenCodeModel,
        zaiModel: updatedZaiModel,
        apiKey: currentApiKey, 
        anthropicApiKey,
        openaiApiKey,
        openaiCompatibleApiKey,
        zaiApiKey,
        qwenCodeOauthPath,
        anthropicMaxTokens, 
        openaiMaxTokens, 
        openaiCompatibleMaxTokens,
        megallmMaxTokens: initialSettings.megallmMaxTokens,
        vscodeLmMaxTokens,
        qwenCodeMaxTokens,
        zaiMaxTokens,
        anthropicTemperature,
        openaiTemperature,
        openaiCompatibleTemperature,
        megallmTemperature: initialSettings.megallmTemperature,
        vscodeLmTemperature,
        qwenCodeTemperature,
        zaiTemperature,
        zaiThinking,
        streamingTimeout: initialSettings.streamingTimeout,
        systemPrompt 
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [provider, anthropicCustomUrl, openaiCustomUrl, openaiCompatibleCustomUrl, zaiCustomUrl, model, anthropicModel, openaiModel, openaiCompatibleModel, vscodeLmModel, qwenCodeModel, zaiModel, apiKey, anthropicApiKey, openaiApiKey, openaiCompatibleApiKey, zaiApiKey, qwenCodeOauthPath, anthropicMaxTokens, openaiMaxTokens, openaiCompatibleMaxTokens, vscodeLmMaxTokens, qwenCodeMaxTokens, zaiMaxTokens, anthropicTemperature, openaiTemperature, openaiCompatibleTemperature, vscodeLmTemperature, qwenCodeTemperature, zaiTemperature, zaiThinking, systemPrompt, onSave, initialSettings.megallmMaxTokens, initialSettings.megallmTemperature, initialSettings.streamingTimeout]);

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
    } else if (provider === 'zai') {
      setZaiModel(model);
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
    setZaiThinking,
    setSystemPrompt,
  };
}
