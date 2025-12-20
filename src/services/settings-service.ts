import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ApiSettings, DEFAULT_SETTINGS } from '../types/api-settings';

export { ApiSettings };

// Fields that can be overridden per workspace
// NOTE: modeModelSettings is intentionally NOT here - it should be global
// so your per-mode model preferences persist across all workspaces
const WORKSPACE_SPECIFIC_FIELDS: (keyof ApiSettings)[] = [
  'indexingSettings',
  'autocompleteSettings',
  'contextSettings',
  'commitMessageSettings',
  'chatMode', // Each workspace can have its own default mode (Agent/Plan/Ask/etc.)
  'mcpServerOverrides', // Each workspace can enable/disable specific MCP servers
];

export class SettingsService {
  private configDir: string;
  private settingsPath: string;
  private settings: ApiSettings | null = null;

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
      console.error('[SettingsService] Failed to create config directory:', error);
    }
  }

  getSettings(): ApiSettings {
    if (this.settings) {
      return this.settings;
    }

    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        const parsed = JSON.parse(data) as Partial<ApiSettings>;
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      } else {
        this.settings = { ...DEFAULT_SETTINGS };
      }
    } catch (error) {
      console.error('[SettingsService] Failed to read settings:', error);
      this.settings = { ...DEFAULT_SETTINGS };
    }

    return this.settings;
  }

  saveSettings(settings: ApiSettings): void {
    try {
      const tmpPath = this.settingsPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.settingsPath);
      this.settings = settings;
    } catch (error) {
      console.error('[SettingsService] Failed to save settings:', error);
      throw error;
    }
  }

  clearSettings(): void {
    try {
      if (fs.existsSync(this.settingsPath)) {
        fs.unlinkSync(this.settingsPath);
      }
      this.settings = null;
    } catch (error) {
      console.error('[SettingsService] Failed to clear settings:', error);
      throw error;
    }
  }

  getSettingsPath(): string {
    return this.settingsPath;
  }

  /**
   * Generate a workspace ID from a workspace path
   * Uses the same algorithm as ChatHistoryService for consistency
   */
  private generateWorkspaceId(workspacePath?: string): string {
    if (!workspacePath) {
      return 'global';
    }
    let hash = 0;
    for (let i = 0; i < workspacePath.length; i++) {
      const char = workspacePath.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `ws_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Get settings with workspace-specific overrides
   */
  getEffectiveSettings(workspacePath?: string): ApiSettings {
    const globalSettings = this.getSettings();
    const workspaceId = this.generateWorkspaceId(workspacePath);

    if (globalSettings.workspaceSettings && globalSettings.workspaceSettings[workspaceId]) {
      const workspaceOverrides = globalSettings.workspaceSettings[workspaceId];
      const filteredOverrides: Partial<ApiSettings> = {};

      // Only apply overrides that are strictly allowed as workspace-specific
      // This ignores legacy data (like provider/model) that might exist in the JSON
      // but should now be treated as global.
      WORKSPACE_SPECIFIC_FIELDS.forEach(field => {
        if (field in workspaceOverrides) {
          // @ts-ignore
          filteredOverrides[field] = workspaceOverrides[field];
        }
      });

      return {
        ...globalSettings,
        ...filteredOverrides
      };
    }

    return globalSettings;
  }

  /**
   * Save settings with workspace-specific overrides logic
   * - API Keys and URLs are always global
   * - Model selection and parameters are workspace-specific if a workspace is active
   */
  saveEffectiveSettings(workspacePath: string | undefined, newSettings: ApiSettings): void {
    const globalSettings = this.getSettings();
    const workspaceId = this.generateWorkspaceId(workspacePath);

    // 1. Prepare the workspace override object
    const workspaceOverride: Partial<ApiSettings> = {};
    WORKSPACE_SPECIFIC_FIELDS.forEach(field => {
      if (field in newSettings) {
        // @ts-ignore
        workspaceOverride[field] = newSettings[field];
      }
    });

    // 2. Prepare the updated global settings
    // We update global settings with ONLY non-workspace-specific fields to ensure:
    // - API keys are saved globally
    // - Global defaults remain stable (don't jump around when changing local workspace models)
    // - Workspace settings remain isolated
    const updatedGlobal: ApiSettings = { 
      ...globalSettings,
      // Preserve existing workspace settings map, will be updated below
      workspaceSettings: globalSettings.workspaceSettings || {} 
    };

    // Update global settings with non-workspace specific fields from newSettings
    Object.keys(newSettings).forEach((key) => {
      const k = key as keyof ApiSettings;
      // Skip workspace-specific fields and the workspaceSettings map itself
      if (!WORKSPACE_SPECIFIC_FIELDS.includes(k) && k !== 'workspaceSettings') {
        // @ts-ignore
        updatedGlobal[k] = newSettings[k];
      }
    });

    // 3. Save the workspace override if we are in a workspace
    if (workspacePath) {
      if (!updatedGlobal.workspaceSettings) {
        updatedGlobal.workspaceSettings = {};
      }
      updatedGlobal.workspaceSettings[workspaceId] = workspaceOverride;
    } else {
      // If we are NOT in a workspace (global context), we SHOULD update the global defaults
      // for model fields, otherwise they can never be changed in a non-workspace window.
      WORKSPACE_SPECIFIC_FIELDS.forEach(field => {
        if (field in newSettings) {
          // @ts-ignore
          updatedGlobal[field] = newSettings[field];
        }
      });
    }

    this.saveSettings(updatedGlobal);
  }

  /**
   * Get global chat mode
   */
  getChatMode(): string {
    const settings = this.getSettings();
    return settings.chatMode || 'agent';
  }

  /**
   * Set global chat mode
   */
  setChatMode(mode: string): void {
    const settings = this.getSettings();
    settings.chatMode = mode;
    this.saveSettings(settings);
  }

  dispose(): void {
    this.settings = null;
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
