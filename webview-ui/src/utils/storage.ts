import type { ApiSettings } from '../types/api-settings';
import { DEFAULT_API_SETTINGS } from '../types/api-settings';
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
      return JSON.parse(stored) as ApiSettings;
    } catch {
      return { ...DEFAULT_API_SETTINGS };
    }
  },

  saveSettings(settings: ApiSettings): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
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
    return !!(settings.provider && settings.apiKey && settings.model);
  },

  getSystemPrompt(): string {
    const settings = this.getSettings();
    return settings.systemPrompt || '';
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
  }
};