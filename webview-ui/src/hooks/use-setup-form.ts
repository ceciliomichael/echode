import { useState, useEffect } from 'react';
import type { ApiSettings } from '../types/api-settings';

/**
 * Custom hook to manage setup form state and logic
 * Extracts state management from setup-page.tsx (SRP)
 */
export function useSetupForm(
  initialSettings: ApiSettings,
  onSave: (settings: ApiSettings) => void
) {
  const [baseUrl, setBaseUrl] = useState(initialSettings.baseUrl);
  const [model, setModel] = useState(initialSettings.model);
  const [apiKey, setApiKey] = useState(initialSettings.apiKey);
  const [maxTokens, setMaxTokens] = useState(initialSettings.maxTokens || 2048);
  const [systemPrompt, setSystemPrompt] = useState(initialSettings.systemPrompt || '');

  // Clear model when endpoint changes
  useEffect(() => {
    const timeoutId = setTimeout(() => setModel(''), 0);
    return () => clearTimeout(timeoutId);
  }, [baseUrl]);

  // Sync with initial settings
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

  // Auto-save with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onSave({ baseUrl, model, apiKey, maxTokens, systemPrompt });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [baseUrl, model, apiKey, maxTokens, systemPrompt, onSave]);

  return {
    baseUrl,
    model,
    apiKey,
    maxTokens,
    systemPrompt,
    setBaseUrl,
    setModel,
    setApiKey,
    setMaxTokens,
    setSystemPrompt,
  };
}
