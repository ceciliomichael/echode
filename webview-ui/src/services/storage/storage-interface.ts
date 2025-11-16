import type { ApiSettings } from '../../types/api-settings';

/**
 * Storage service interface for dependency inversion
 * Allows for easy testing and alternative implementations
 */
export interface IStorageService {
  getSettings(): ApiSettings;
  saveSettings(settings: ApiSettings): void;
  clearSettings(): void;
  hasSettings(): boolean;
  getSystemPrompt(): string;
}
