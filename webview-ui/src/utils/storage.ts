import type { ApiSettings, Provider } from '../types/api-settings';
import { DEFAULT_API_SETTINGS } from '../types/api-settings';
import { DEFAULT_CHAT_MODE } from '../types/chat-mode';
import type { ChatSession } from '../types/chat-session';
import type { Message } from '../types/chat';

const STORAGE_KEY = 'echode_api_settings';
const CURRENT_SESSION_KEY = 'echode_current_session_id';

export const storageService = {
  getSettings(): ApiSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return { ...DEFAULT_API_SETTINGS };
      }
      const parsed = JSON.parse(stored) as ApiSettings;

      // Normalize settings to ensure per-provider fields are populated
      const normalized: ApiSettings = {
        ...DEFAULT_API_SETTINGS,
        ...parsed,
      };

      const provider: Provider = normalized.provider;

      // Backfill provider-specific API keys from generic apiKey when missing
      if (!normalized.anthropicApiKey && normalized.apiKey) {
        normalized.anthropicApiKey = normalized.apiKey;
      }
      if (!normalized.openaiApiKey && normalized.apiKey) {
        normalized.openaiApiKey = normalized.apiKey;
      }
      if (!normalized.openaiCompatibleApiKey && normalized.apiKey) {
        normalized.openaiCompatibleApiKey = normalized.apiKey;
      }

      // Backfill provider-specific models from generic model when missing
      if (!normalized.anthropicModel && normalized.model) {
        normalized.anthropicModel = normalized.model;
      }
      if (!normalized.openaiModel && normalized.model) {
        normalized.openaiModel = normalized.model;
      }
      if (!normalized.openaiCompatibleModel && normalized.model) {
        normalized.openaiCompatibleModel = normalized.model;
      }
      if (!normalized.vscodeLmModel && normalized.model) {
        normalized.vscodeLmModel = normalized.model;
      }

      // Ensure generic apiKey/model mirror the active provider for convenience
      if (provider === 'anthropic') {
        normalized.apiKey = normalized.anthropicApiKey || '';
        normalized.model = normalized.anthropicModel || '';
      } else if (provider === 'openai') {
        normalized.apiKey = normalized.openaiApiKey || '';
        normalized.model = normalized.openaiModel || '';
      } else if (provider === 'openai-compatible') {
        normalized.apiKey = normalized.openaiCompatibleApiKey || '';
        normalized.model = normalized.openaiCompatibleModel || '';
      } else if (provider === 'vscode-lm') {
        // VS Code LM does not require apiKey
        normalized.apiKey = '';
        normalized.model = normalized.vscodeLmModel || '';
      }

      return normalized;
    } catch {
      return { ...DEFAULT_API_SETTINGS };
    }
  },

  saveSettings(settings: ApiSettings): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      // Dispatch custom event for same-window listeners
      window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: settings }));
    } catch {
      console.error('Failed to save settings');
    }
  },

  clearSettings(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
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
    
    const content = firstUserMessage.content.trim();
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
    
    const content = firstUserMessage.content.trim();
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