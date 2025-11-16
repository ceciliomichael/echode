import type { ApiSettings } from '../../types/api-settings';
import { DEFAULT_API_SETTINGS } from '../../types/api-settings';
import type { IStorageService } from './storage-interface';

/**
 * LocalStorage implementation of IStorageService
 * Follows Dependency Inversion Principle
 */
export class LocalStorageService implements IStorageService {
  constructor(private readonly storageKey: string) {}

  getSettings(): ApiSettings {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return { ...DEFAULT_API_SETTINGS };
      }
      return JSON.parse(stored) as ApiSettings;
    } catch {
      return { ...DEFAULT_API_SETTINGS };
    }
  }

  saveSettings(settings: ApiSettings): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(settings));
    } catch {
      console.error('Failed to save settings');
    }
  }

  clearSettings(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      console.error('Failed to clear settings');
    }
  }

  hasSettings(): boolean {
    const settings = this.getSettings();
    return !!(settings.baseUrl && settings.apiKey && settings.model);
  }

  getSystemPrompt(): string {
    const settings = this.getSettings();
    return settings.systemPrompt || '';
  }
}
