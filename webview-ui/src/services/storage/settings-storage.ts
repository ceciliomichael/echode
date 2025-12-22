import type { ApiSettings, Provider } from '../../types/api-settings';
import { DEFAULT_API_SETTINGS } from '../../types/api-settings';

/**
 * Manages local storage of settings and synchronization with the backend.
 * Handles caching, initialization, and updates.
 */
export class SettingsStorage {
  private cachedSettings: ApiSettings | null = null;
  private settingsLoadPromise: Promise<ApiSettings> | null = null;
  private isLoaded = false;

  constructor() {
    // Listen for updates from backend
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  private handleMessage(event: MessageEvent): void {
    const message = event.data;
    if (message.type === 'apiSettingsLoaded') {
      const normalized = this.normalizeSettings(message.settings || {});
      this.updateCache(normalized);
      this.isLoaded = true;
      // Resolve any pending promise (though promise constructor logic handles the initial load)
    }
  }

  /**
   * Normalize settings - set generic apiKey/model from active provider (read-only mirror)
   */
  private normalizeSettings(parsed: Partial<ApiSettings>): ApiSettings {
    const normalized: ApiSettings = {
      ...DEFAULT_API_SETTINGS,
      ...parsed,
    };

    const provider: Provider = normalized.provider;

    // Set generic apiKey/model to mirror the active provider (for convenience/compatibility)
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

  /**
   * Update local cache and notify listeners
   */
  private updateCache(settings: ApiSettings): void {
    this.cachedSettings = settings;
    window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: settings }));
  }

  /**
   * Initialize settings loading
   */
  initialize(): Promise<ApiSettings> {
    if (this.settingsLoadPromise) {
      return this.settingsLoadPromise;
    }

    this.settingsLoadPromise = new Promise((resolve) => {
      // Setup temporary one-time listener for the initial response
      const handler = (event: MessageEvent) => {
        const message = event.data;
        if (message.type === 'apiSettingsLoaded') {
          window.removeEventListener('message', handler);
          const normalized = this.normalizeSettings(message.settings || {});
          this.updateCache(normalized);
          this.isLoaded = true;
          this.settingsLoadPromise = null;
          resolve(normalized);
        }
      };

      window.addEventListener('message', handler);

      if (window.vscode) {
        window.vscode.postMessage({ type: 'getApiSettings' });
      } else {
        // Fallback
        window.removeEventListener('message', handler);
        this.settingsLoadPromise = null;
        resolve({ ...DEFAULT_API_SETTINGS });
      }

      // Timeout fallback
      setTimeout(() => {
        window.removeEventListener('message', handler);
        if (!this.isLoaded) {
          this.settingsLoadPromise = null;
          resolve(this.cachedSettings || { ...DEFAULT_API_SETTINGS });
        }
      }, 3000);
    });

    return this.settingsLoadPromise;
  }

  /**
   * Get settings synchronously (if loaded) or default
   */
  getSettings(): ApiSettings {
    if (this.cachedSettings) {
      return this.cachedSettings;
    }
    // Trigger load if needed
    if (!this.settingsLoadPromise && !this.isLoaded) {
      this.initialize();
    }
    return { ...DEFAULT_API_SETTINGS };
  }

  /**
   * Get settings asynchronously
   */
  async getSettingsAsync(): Promise<ApiSettings> {
    if (this.cachedSettings && this.isLoaded) {
      return this.cachedSettings;
    }
    return this.initialize();
  }

  /**
   * Save settings to backend
   */
  saveSettings(settings: ApiSettings): void {
    try {
      this.updateCache(settings);
      if (window.vscode) {
        window.vscode.postMessage({ type: 'saveApiSettings', settings });
      }
    } catch (error) {
      console.error('[SettingsStorage] Failed to save settings:', error);
    }
  }

  /**
   * Clear settings
   */
  clearSettings(): void {
    try {
      this.cachedSettings = null;
      this.isLoaded = false;
      if (window.vscode) {
        window.vscode.postMessage({ type: 'clearApiSettings' });
      }
    } catch (error) {
      console.error('[SettingsStorage] Failed to clear settings:', error);
    }
  }

  /**
   * Check if settings are valid/present
   */
  hasSettings(): boolean {
    const settings = this.getSettings();
    if (!settings.provider) {return false;}
    
    // We delegate complex validation logic if needed, or keep simpler checks here.
    // Ideally, validation should be in a separate helper or simple check.
    // For now, mirroring existing logic (simplified) or relying on effective usage.
    // Given the previous fix, we just check existence of provider to know if "initialized".
    return !!settings.provider;
  }
}