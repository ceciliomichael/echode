import type { ApiSettings, Provider } from '../types/api-settings';
import { DEFAULT_API_SETTINGS } from '../types/api-settings';
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

  getChatMode(): 'agent' | 'plan' | 'ask' | 'general' {
    const settings = this.getSettings();
    return settings.chatMode || DEFAULT_CHAT_MODE;
  },

  setChatMode(mode: 'agent' | 'plan' | 'ask' | 'general'): void {
    const settings = this.getSettings();
    settings.chatMode = mode;
    this.saveSettings(settings);
  }
};