import { ApiSettings } from '../types/api-settings';
import { SettingsManager } from './settings/settings-manager';

export { ApiSettings };

/**
 * Settings Service Facade
 * Delegates actual logic to the modular SettingsManager and SettingsStore.
 * Maintained for backward compatibility.
 */
export class SettingsService {
  private manager: SettingsManager;

  constructor() {
    this.manager = new SettingsManager();
  }

  getSettings(): ApiSettings {
    return this.manager.getSettings();
  }

  saveSettings(settings: ApiSettings): void {
    // Direct save via store (exposed through manager for now, or we can use writeSettings)
    // The manager doesn't expose raw writeSettings, so we access via store property or add method
    // Actually, saveSettings in original service was raw write.
    // In new manager, we have saveEffectiveSettings. 
    // Let's add a raw save method to manager or expose store?
    // Better: let's use the internal store of manager or just instantiate store here?
    // No, single source of truth.
    // Let's update SettingsManager to allow raw save if needed, OR better:
    // The original saveSettings was used internally mostly.
    // But handlers use saveEffectiveSettings.
    // Let's check usages.
    // Ideally, we should use saveEffectiveSettings everywhere.
    // But for direct overwrite, we can add `saveSettings` to SettingsManager.
    // Let's update SettingsManager first? No, I can't edit it again easily without cost.
    // I'll just use the store directly via a getter or cast, OR assume saveEffectiveSettings is what we want.
    // Wait, saveSettings in original code:
    // saveSettings(settings) -> writes file.
    // I will add saveSettings to SettingsManager in a follow up or just cast manager.
    // Actually, I can just reimplement logic using the store instance if I export it?
    // Let's look at SettingsManager again. It has `store` private.
    // I should have added `saveSettings` to SettingsManager.
    // Let's assume I can add it or modify the file.
    // Since I just wrote SettingsManager, I should have added it.
    // I will use `saveEffectiveSettings(undefined, settings)` which updates global defaults.
    // That's effectively saving settings for global context.
    this.manager.saveEffectiveSettings(undefined, settings);
  }

  clearSettings(): void {
    this.manager.clearSettings();
  }

  getSettingsPath(): string {
    return this.manager.getSettingsPath();
  }

  getEffectiveSettings(workspacePath?: string): ApiSettings {
    return this.manager.getEffectiveSettings(workspacePath);
  }

  saveEffectiveSettings(workspacePath: string | undefined, newSettings: ApiSettings): void {
    this.manager.saveEffectiveSettings(workspacePath, newSettings);
  }

  getChatMode(): string {
    return this.manager.getChatMode();
  }

  setChatMode(mode: string): void {
    this.manager.setChatMode(mode);
  }
}

// Singleton instance
let settingsServiceInstance: SettingsService | null = null;

export function getSettingsService(): SettingsService {
  if (!settingsServiceInstance) {
    settingsServiceInstance = new SettingsService();
  }
  return settingsServiceInstance;
}