import type { ApiSettings, Provider, ModeModelSettings } from '../types/api-settings';
import { DEFAULT_API_SETTINGS, isCustomProvider } from '../types/api-settings';
import type { ChatMode } from '../types/chat-mode';
import { DEFAULT_CHAT_MODE } from '../types/chat-mode';
import type { ChatSession } from '../types/chat-session';
import type { Message } from '../types/chat';
import { stripAttachedFileBlocks } from './document-utils';

const CURRENT_SESSION_KEY = 'echode_current_session_id';

// In-memory cache for settings (loaded from extension backend)
let cachedSettings: ApiSettings | null = null;
let settingsLoadPromise: Promise<ApiSettings> | null = null;
let settingsLoadedFromBackend = false;

// Normalize settings - set generic apiKey/model from active provider (read-only mirror)
function normalizeSettings(parsed: Partial<ApiSettings>): ApiSettings {
  const normalized: ApiSettings = {
    ...DEFAULT_API_SETTINGS,
    ...parsed,
  };

  const provider: Provider = normalized.provider;

  // Set generic apiKey/model to mirror the active provider (for convenience/compatibility)
  // Each provider keeps its own separate API key - NO cross-provider backfill
  if (provider === 'anthropic') {
    normalized.apiKey = normalized.anthropicApiKey || '';
    normalized.model = normalized.anthropicModel || '';
  } else if (provider === 'openai') {
    normalized.apiKey = normalized.openaiApiKey || '';
    normalized.model = normalized.openaiModel || '';
  } else if (provider === 'openai-compatible') {
    normalized.apiKey = normalized.openaiCompatibleApiKey || '';
    normalized.model = normalized.openaiCompatibleModel || '';
  } else if (provider === 'megallm') {
    normalized.apiKey = normalized.megallmApiKey || '';
    normalized.model = normalized.megallmModel || '';
  } else if (provider === 'qwen-code') {
    normalized.apiKey = '';
    normalized.model = normalized.qwenCodeModel || '';
  } else if (provider === 'vscode-lm') {
    normalized.apiKey = '';
    normalized.model = normalized.vscodeLmModel || '';
  }

  return normalized;
}

// Request settings from extension backend
function requestSettingsFromBackend(): Promise<ApiSettings> {
  if (settingsLoadPromise) {
    return settingsLoadPromise;
  }

  settingsLoadPromise = new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'apiSettingsLoaded') {
        window.removeEventListener('message', handler);
        const normalized = normalizeSettings(message.settings || {});
        cachedSettings = normalized;
        settingsLoadedFromBackend = true;
        settingsLoadPromise = null;
        // Dispatch event to notify listeners (e.g., useChatModel hook) of loaded settings
        window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: normalized }));
        resolve(normalized);
      }
    };

    window.addEventListener('message', handler);

    if (window.vscode) {
      window.vscode.postMessage({ type: 'getApiSettings' });
    } else {
      // Fallback if vscode API not available
      window.removeEventListener('message', handler);
      settingsLoadPromise = null;
      resolve({ ...DEFAULT_API_SETTINGS });
    }

    // Timeout fallback
    setTimeout(() => {
      window.removeEventListener('message', handler);
      if (!settingsLoadedFromBackend) {
        settingsLoadPromise = null;
        resolve(cachedSettings || { ...DEFAULT_API_SETTINGS });
      }
    }, 3000);
  });

  return settingsLoadPromise;
}

// Initialize settings on load
export function initializeSettings(): Promise<ApiSettings> {
  return requestSettingsFromBackend();
}

export const storageService = {
  getSettings(): ApiSettings {
    // Return cached settings if available, otherwise return defaults
    // The actual settings will be loaded asynchronously
    if (cachedSettings) {
      return cachedSettings;
    }
    // Trigger async load if not started
    if (!settingsLoadPromise && !settingsLoadedFromBackend) {
      requestSettingsFromBackend();
    }
    return { ...DEFAULT_API_SETTINGS };
  },

  getSettingsAsync(): Promise<ApiSettings> {
    if (cachedSettings && settingsLoadedFromBackend) {
      return Promise.resolve(cachedSettings);
    }
    return requestSettingsFromBackend();
  },

  saveSettings(settings: ApiSettings): void {
    try {
      cachedSettings = settings;
      // Save to extension backend
      if (window.vscode) {
        window.vscode.postMessage({ type: 'saveApiSettings', settings });
      }
      // Dispatch custom event for same-window listeners
      window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: settings }));
    } catch {
      console.error('Failed to save settings');
    }
  },

  clearSettings(): void {
    try {
      cachedSettings = null;
      settingsLoadedFromBackend = false;
      if (window.vscode) {
        window.vscode.postMessage({ type: 'clearApiSettings' });
      }
    } catch {
      console.error('Failed to clear settings');
    }
  },

  hasSettings(): boolean {
    const settings = this.getSettings();

    if (!settings.provider) {
      return false;
    }

    // Provider-aware validation
    if (isCustomProvider(settings.provider)) {
      const customId = settings.provider.replace('custom-', '');
      const customProvider = settings.customProviders?.find(cp => cp.id === customId);
      // For custom providers, we check if the provider exists and has a base URL
      // We don't strictly enforce API key (optional) or model (might be provided by default)
      return !!(customProvider && customProvider.baseUrl);
    }

    if (settings.provider === 'anthropic') {
      return !!(settings.anthropicApiKey && (settings.anthropicModel || settings.model));
    }

    if (settings.provider === 'openai') {
      return !!(settings.openaiApiKey && (settings.openaiModel || settings.model));
    }

    if (settings.provider === 'openai-compatible') {
      return !!(settings.openaiCompatibleApiKey && (settings.openaiCompatibleModel || settings.model));
    }

    if (settings.provider === 'megallm') {
      return !!(settings.megallmApiKey && (settings.megallmModel || settings.model));
    }

    if (settings.provider === 'qwen-code') {
      return !!(settings.qwenCodeModel || settings.model);
    }

    // VS Code LM provider: only model is required
    if (settings.provider === 'vscode-lm') {
      return !!(settings.vscodeLmModel || settings.model);
    }

    return false;
  },

  getSystemPrompt(): string {
    const settings = this.getSettings();
    return settings.systemPrompt || '';
  },

  getEnabledTools(): import('../types/api-settings').Tool[] | undefined {
    const settings = this.getSettings();
    return settings.enabledTools;
  },

  getCurrentSessionId(): string | null {
    try {
      return localStorage.getItem(CURRENT_SESSION_KEY);
    } catch {
      return null;
    }
  },

  setCurrentSessionId(sessionId: string): void {
    try {
      localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
    } catch {
      console.error('Failed to save current session id');
    }
  },

  clearCurrentSessionId(): void {
    try {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    } catch {
      console.error('Failed to clear current session id');
    }
  },

  saveSession(session: ChatSession): void {
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'saveSession',
        session,
      });
    }
  },

  generateTitle(messages: Message[]): string {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (!firstUserMessage) {
      return 'New Chat';
    }

    const content = stripAttachedFileBlocks(firstUserMessage.content).trim();
    const maxLength = 50;

    if (content.length <= maxLength) {
      return content;
    }

    return content.substring(0, maxLength).trim() + '...';
  },

  getPreview(messages: Message[]): string {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (!firstUserMessage) {
      return '';
    }

    const content = stripAttachedFileBlocks(firstUserMessage.content).trim();
    const maxLength = 100;

    if (content.length <= maxLength) {
      return content;
    }

    return content.substring(0, maxLength).trim() + '...';
  },

  getChatMode(): ChatMode {
    // Return cached value from settings (will be updated by backend)
    const settings = this.getSettings();
    return settings.chatMode || DEFAULT_CHAT_MODE;
  },

  setChatMode(mode: ChatMode): void {
    // Update local cache
    const currentSettings = this.getSettings();
    
    // Get the model for the new mode to sync global settings
    const modeModel = this.getModeModel(mode);
    
    const updated: ApiSettings = {
      ...currentSettings,
      chatMode: mode,
      provider: modeModel.provider,
      model: modeModel.model
    };

    // Also update provider-specific model fields to match the mode's selection
    if (modeModel.provider === 'anthropic') updated.anthropicModel = modeModel.model;
    else if (modeModel.provider === 'openai') updated.openaiModel = modeModel.model;
    else if (modeModel.provider === 'openai-compatible') updated.openaiCompatibleModel = modeModel.model;
    else if (modeModel.provider === 'megallm') updated.megallmModel = modeModel.model;
    else if (modeModel.provider === 'vscode-lm') updated.vscodeLmModel = modeModel.model;
    else if (modeModel.provider === 'qwen-code') updated.qwenCodeModel = modeModel.model;

    // Save to backend (syncs both mode and global model)
    this.saveSettings(updated);
    
    // Dispatch event for same-window listeners
    window.dispatchEvent(new CustomEvent('chatModeUpdated', { detail: mode }));
  },

  /**
   * Get the provider and model for a specific chat mode.
   * Falls back to global provider/model if no mode-specific setting exists.
   */
  getModeModel(mode: ChatMode): ModeModelSettings {
    const settings = this.getSettings();
    const modeSettings = settings.modeModelSettings?.[mode];
    
    if (modeSettings) {
      return modeSettings;
    }
    
    // Fallback to global provider/model
    return {
      provider: settings.provider,
      model: settings.model,
    };
  },

  /**
   * Set the provider and model for a specific chat mode.
   * Updates both mode-specific settings and syncs to backend.
   */
  setModeModel(mode: ChatMode, provider: Provider, model: string): void {
    const currentSettings = this.getSettings();
    
    // Update the mode-specific settings using spread to ensure immutability
    const modeModelSettings = {
      ...(currentSettings.modeModelSettings || {}),
      [mode]: { provider, model }
    };
    
    // Create updated settings object
    // When setting a mode's model, we ALSO update the global provider/model
    // so the rest of the system stays in sync with the current selection.
    const updated: ApiSettings = {
      ...currentSettings,
      modeModelSettings,
      provider,
      model
    };

    // Update provider-specific fields when model changes
    if (provider === 'anthropic') {
      updated.anthropicModel = model;
    } else if (provider === 'openai') {
      updated.openaiModel = model;
    } else if (provider === 'openai-compatible') {
      updated.openaiCompatibleModel = model;
    } else if (provider === 'megallm') {
      updated.megallmModel = model;
    } else if (provider === 'vscode-lm') {
      updated.vscodeLmModel = model;
    } else if (provider === 'qwen-code') {
      updated.qwenCodeModel = model;
    }

    this.saveSettings(updated);
  },
};