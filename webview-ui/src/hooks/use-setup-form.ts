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
  const [apiKey, setApiKey] = useState(initialSettings.apiKey);
  const [anthropicMaxTokens, setAnthropicMaxTokens] = useState(initialSettings.anthropicMaxTokens);
  const [openaiMaxTokens, setOpenaiMaxTokens] = useState(initialSettings.openaiMaxTokens);
  const [openaiCompatibleMaxTokens, setOpenaiCompatibleMaxTokens] = useState(initialSettings.openaiCompatibleMaxTokens);
  const [systemPrompt, setSystemPrompt] = useState(initialSettings.systemPrompt || '');

  // Restore model when provider changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const savedModel = provider === 'anthropic' 
        ? anthropicModel 
        : provider === 'openai' 
        ? openaiModel 
        : openaiCompatibleModel;
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
      setApiKey(initialSettings.apiKey);
      setAnthropicMaxTokens(initialSettings.anthropicMaxTokens);
      setOpenaiMaxTokens(initialSettings.openaiMaxTokens);
      setOpenaiCompatibleMaxTokens(initialSettings.openaiCompatibleMaxTokens);
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
      : openaiCompatibleCustomUrl;
    
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
        apiKey, 
        anthropicMaxTokens, 
        openaiMaxTokens, 
        openaiCompatibleMaxTokens,
        systemPrompt 
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [provider, anthropicCustomUrl, openaiCustomUrl, openaiCompatibleCustomUrl, model, anthropicModel, openaiModel, openaiCompatibleModel, apiKey, anthropicMaxTokens, openaiMaxTokens, openaiCompatibleMaxTokens, systemPrompt, onSave]);

  // Handle provider change with model persistence
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

  return {
    provider,
    anthropicCustomUrl,
    openaiCustomUrl,
    openaiCompatibleCustomUrl,
    model,
    anthropicModel,
    openaiModel,
    openaiCompatibleModel,
    apiKey,
    anthropicMaxTokens,
    openaiMaxTokens,
    openaiCompatibleMaxTokens,
    systemPrompt,
    setProvider: handleProviderChange,
    setAnthropicCustomUrl,
    setOpenaiCustomUrl,
    setOpenaiCompatibleCustomUrl,
    setModel,
    setApiKey,
    setAnthropicMaxTokens,
    setOpenaiMaxTokens,
    setOpenaiCompatibleMaxTokens,
    setSystemPrompt,
  };
}
