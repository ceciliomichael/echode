import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ApiSettings, DEFAULT_SETTINGS } from '../../types/api-settings';

/**
 * Handles low-level file I/O for settings persistence.
 * Responsible for reading/writing the JSON file and managing the config directory.
 */
export class SettingsStore {
  private configDir: string;
  private settingsPath: string;
  private cachedSettings: ApiSettings | null = null;

  constructor() {
    this.configDir = path.join(os.homedir(), '.echode');
    this.settingsPath = path.join(this.configDir, 'settings.json');
    this.ensureConfigDirectory();
  }

  private ensureConfigDirectory(): void {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
    } catch (error) {
      console.error('[SettingsStore] Failed to create config directory:', error);
    }
  }

  getSettingsPath(): string {
    return this.settingsPath;
  }

  /**
   * Reads settings from disk or returns cached version.
   * If file doesn't exist or is invalid, returns default settings.
   */
  readSettings(): ApiSettings {
    if (this.cachedSettings) {
      return this.cachedSettings;
    }

    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        const parsed = JSON.parse(data) as Partial<ApiSettings>;
        // Merge with defaults to ensure all fields exist
        this.cachedSettings = { ...DEFAULT_SETTINGS, ...parsed };
      } else {
        this.cachedSettings = { ...DEFAULT_SETTINGS };
      }
    } catch (error) {
      console.error('[SettingsStore] Failed to read settings:', error);
      this.cachedSettings = { ...DEFAULT_SETTINGS };
    }

    return this.cachedSettings!;
  }

  /**
   * Writes settings to disk and updates cache.
   */
  writeSettings(settings: ApiSettings): void {
    try {
      const tmpPath = this.settingsPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.settingsPath);
      this.cachedSettings = settings;
    } catch (error) {
      console.error('[SettingsStore] Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * Clears settings file and cache.
   */
  clearSettings(): void {
    try {
      if (fs.existsSync(this.settingsPath)) {
        fs.unlinkSync(this.settingsPath);
      }
      this.cachedSettings = null;
    } catch (error) {
      console.error('[SettingsStore] Failed to clear settings:', error);
      throw error;
    }
  }

  /**
   * Force reload from disk (invalidates cache).
   */
  reloadSettings(): ApiSettings {
    this.cachedSettings = null;
    return this.readSettings();
  }
}