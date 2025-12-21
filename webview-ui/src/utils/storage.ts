import type { ApiSettings, Provider, ModeModelSettings } from '../types/api-settings';
import type { ChatMode } from '../types/chat-mode';
import { DEFAULT_CHAT_MODE } from '../types/chat-mode';
import type { ChatSession } from '../types/chat-session';
import type { Message } from '../types/chat';
import { stripAttachedFileBlocks } from './document-utils';
import { SettingsStorage } from '../services/storage/settings-storage';
import { ModeHelpers } from '../services/storage/mode-helpers';

const CURRENT_SESSION_KEY = 'echode_current_session_id';

// Initialize singleton settings storage
const settingsStorage = new SettingsStorage();

/**
 * Unified storage service acting as a facade for modular services.
 * Maintains backward compatibility while delegating logic.
 */
export const storageService = {
  // === Settings Management (Delegated to SettingsStorage) ===

  getSettings(): ApiSettings {
    return settingsStorage.getSettings();
  },

  getSettingsAsync(): Promise<ApiSettings> {
    return settingsStorage.getSettingsAsync();
  },

  saveSettings(settings: ApiSettings): void {
    settingsStorage.saveSettings(settings);
  },

  clearSettings(): void {
    settingsStorage.clearSettings();
  },

  hasSettings(): boolean {
    return settingsStorage.hasSettings();
  },

  getSystemPrompt(): string {
    const settings = this.getSettings();
    return settings.systemPrompt || '';
  },

  getEnabledTools(): import('../types/api-settings').Tool[] | undefined {
    const settings = this.getSettings();
    return settings.enabledTools;
  },

  /**
   * Initialize settings on load
   */
  initializeSettings(): Promise<ApiSettings> {
    return settingsStorage.initialize();
  },

  // === Session Management (Kept here for now) ===

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

  // === Utility Functions ===

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

  // === Mode Management (Delegated to ModeHelpers + SettingsStorage) ===

  getChatMode(): ChatMode {
    const settings = this.getSettings();
    return settings.chatMode || DEFAULT_CHAT_MODE;
  },

  setChatMode(mode: ChatMode): void {
    const currentSettings = this.getSettings();
    
    const updated: ApiSettings = {
      ...currentSettings,
      chatMode: mode,
    };

    this.saveSettings(updated);
    
    // Dispatch event for same-window listeners
    window.dispatchEvent(new CustomEvent('chatModeUpdated', { detail: mode }));
  },

  /**
   * Get the provider and model for a specific chat mode.
   */
  getModeModel(mode: ChatMode): ModeModelSettings {
    const settings = this.getSettings();
    return ModeHelpers.getModeModel(settings, mode);
  },

  /**
   * Set the provider and model for a specific chat mode.
   */
  setModeModel(mode: ChatMode, provider: Provider, model: string): void {
    const currentSettings = this.getSettings();
    const updated = ModeHelpers.updateModeModel(currentSettings, mode, provider, model);
    this.saveSettings(updated);
  },
};

// Export initializeSettings as standalone for backward compatibility if needed
export function initializeSettings(): Promise<ApiSettings> {
  return settingsStorage.initialize();
}