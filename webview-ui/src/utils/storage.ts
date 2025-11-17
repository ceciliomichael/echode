import type { ApiSettings } from '../types/api-settings';
import { DEFAULT_API_SETTINGS } from '../types/api-settings';

const STORAGE_KEY = 'echode_api_settings';

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
  }
};