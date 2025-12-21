import { ApiSettings } from '../../types/api-settings';
import { SettingsStore } from './settings-store';

// Fields that can be overridden per workspace
const WORKSPACE_SPECIFIC_FIELDS: (keyof ApiSettings)[] = [
  'indexingSettings',
  'autocompleteSettings',
  'contextSettings',
  'commitMessageSettings',
  'chatMode', // Each workspace can have its own default mode
  'mcpServerOverrides', // Each workspace can enable/disable specific MCP servers
];

/**
 * Handles business logic for settings (merging, workspace overrides, etc.).
 * Delegates persistence to SettingsStore.
 */
export class SettingsManager {
  private store: SettingsStore;

  constructor() {
    this.store = new SettingsStore();
  }

  getSettingsPath(): string {
    return this.store.getSettingsPath();
  }

  getSettings(): ApiSettings {
    return this.store.readSettings();
  }

  clearSettings(): void {
    this.store.clearSettings();
  }

  /**
   * Generate a workspace ID from a workspace path
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
    const globalSettings = this.store.readSettings();
    const workspaceId = this.generateWorkspaceId(workspacePath);

    if (globalSettings.workspaceSettings && globalSettings.workspaceSettings[workspaceId]) {
      const workspaceOverrides = globalSettings.workspaceSettings[workspaceId];
      const filteredOverrides: Partial<ApiSettings> = {};

      // Only apply overrides that are strictly allowed as workspace-specific
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
   */
  saveEffectiveSettings(workspacePath: string | undefined, newSettings: ApiSettings): void {
    const globalSettings = this.store.readSettings();
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
    // Start with existing global settings
    const updatedGlobal: ApiSettings = { 
      ...globalSettings,
      // Preserve existing workspace settings map, will be updated below
      workspaceSettings: globalSettings.workspaceSettings || {} 
    };

    // Update global settings with ONLY non-workspace-specific fields from newSettings
    // This ensures keys/modeModelSettings are saved globally
    Object.keys(newSettings).forEach((key) => {
      const k = key as keyof ApiSettings;
      // Skip workspace-specific fields and the workspaceSettings map itself
      if (!WORKSPACE_SPECIFIC_FIELDS.includes(k) && k !== 'workspaceSettings') {
        // @ts-ignore
        updatedGlobal[k] = newSettings[k];
      }
    });

    // Explicit check to ensure modeModelSettings is preserved if present
    if (newSettings.modeModelSettings) {
      updatedGlobal.modeModelSettings = newSettings.modeModelSettings;
    }

    // 3. Save the workspace override if we are in a workspace
    if (workspacePath) {
      if (!updatedGlobal.workspaceSettings) {
        updatedGlobal.workspaceSettings = {};
      }
      updatedGlobal.workspaceSettings[workspaceId] = workspaceOverride;
    } else {
      // If NOT in a workspace (global context), update global defaults for workspace fields
      WORKSPACE_SPECIFIC_FIELDS.forEach(field => {
        if (field in newSettings) {
          // @ts-ignore
          updatedGlobal[field] = newSettings[field];
        }
      });
    }

    this.store.writeSettings(updatedGlobal);
  }

  getChatMode(): string {
    const settings = this.store.readSettings();
    return settings.chatMode || 'agent';
  }

  setChatMode(mode: string): void {
    const settings = this.store.readSettings();
    settings.chatMode = mode;
    this.store.writeSettings(settings);
  }
}