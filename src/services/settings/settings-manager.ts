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

  private migrateCustomProviderReferences(previous: ApiSettings, next: ApiSettings): ApiSettings {
    const previousProviders = previous.customProviders;
    const nextProviders = next.customProviders;

    if (!Array.isArray(previousProviders) || !Array.isArray(nextProviders)) {
      return next;
    }

    const usedPrevIds = new Set<string>();
    const usedNextIds = new Set<string>();
    const idMap = new Map<string, string>();

    for (const np of nextProviders) {
      const match = previousProviders.find(pp => pp.id === np.id);
      if (match) {
        usedPrevIds.add(match.id);
        usedNextIds.add(np.id);
      }
    }

    const norm = (v: string | undefined) => (v || '').trim().toLowerCase();

    for (const np of nextProviders) {
      if (usedNextIds.has(np.id)) {
        continue;
      }

      const prevByBaseUrl = previousProviders.find(pp => !usedPrevIds.has(pp.id) && norm(pp.baseUrl) === norm(np.baseUrl));
      if (prevByBaseUrl) {
        idMap.set(prevByBaseUrl.id, np.id);
        usedPrevIds.add(prevByBaseUrl.id);
        usedNextIds.add(np.id);
        continue;
      }

      const prevByName = previousProviders.find(pp => !usedPrevIds.has(pp.id) && norm(pp.name) === norm(np.name));
      if (prevByName) {
        idMap.set(prevByName.id, np.id);
        usedPrevIds.add(prevByName.id);
        usedNextIds.add(np.id);
      }
    }

    for (let i = 0; i < nextProviders.length; i += 1) {
      const np = nextProviders[i];
      if (usedNextIds.has(np.id)) {
        continue;
      }
      const pp = previousProviders[i];
      if (!pp || usedPrevIds.has(pp.id)) {
        continue;
      }
      idMap.set(pp.id, np.id);
      usedPrevIds.add(pp.id);
      usedNextIds.add(np.id);
    }

    if (idMap.size === 0) {
      return next;
    }

    const remapProviderString = (provider: string | undefined): string | undefined => {
      if (!provider || !provider.startsWith('custom-')) {
        return provider;
      }
      const rawId = provider.slice('custom-'.length);
      const newId = idMap.get(rawId);
      return newId ? `custom-${newId}` : provider;
    };

    const migrated: ApiSettings = {
      ...next,
      provider: remapProviderString(next.provider) || next.provider,
      indexingSettings: next.indexingSettings
        ? {
          ...next.indexingSettings,
          provider: remapProviderString(next.indexingSettings.provider) || next.indexingSettings.provider,
        }
        : next.indexingSettings,
      autocompleteSettings: next.autocompleteSettings
        ? {
          ...next.autocompleteSettings,
          provider: remapProviderString(next.autocompleteSettings.provider) || next.autocompleteSettings.provider,
        }
        : next.autocompleteSettings,
      commitMessageSettings: next.commitMessageSettings
        ? {
          ...next.commitMessageSettings,
          provider: remapProviderString(next.commitMessageSettings.provider) || next.commitMessageSettings.provider,
        }
        : next.commitMessageSettings,
      contextSettings: next.contextSettings
        ? {
          ...next.contextSettings,
          ...(typeof (next.contextSettings as (typeof next.contextSettings & { compressionProvider?: string })).compressionProvider === 'string'
            ? {
              compressionProvider: remapProviderString(
                (next.contextSettings as (typeof next.contextSettings & { compressionProvider?: string })).compressionProvider
              ) || (next.contextSettings as (typeof next.contextSettings & { compressionProvider?: string })).compressionProvider,
            }
            : {}),
        }
        : next.contextSettings,
      modeModelSettings: next.modeModelSettings
        ? Object.fromEntries(
          Object.entries(next.modeModelSettings).map(([mode, mm]) => [
            mode,
            {
              ...mm,
              provider: remapProviderString(mm.provider) || mm.provider,
            },
          ])
        )
        : next.modeModelSettings,
    };

    return migrated;
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

    const migratedSettings = this.migrateCustomProviderReferences(globalSettings, newSettings);

    // 1. Prepare the workspace override object
    const workspaceOverride: Partial<ApiSettings> = {};
    WORKSPACE_SPECIFIC_FIELDS.forEach(field => {
      if (field in migratedSettings) {
        // @ts-ignore
        workspaceOverride[field] = migratedSettings[field];
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
    Object.keys(migratedSettings).forEach((key) => {
      const k = key as keyof ApiSettings;
      // Skip workspace-specific fields and the workspaceSettings map itself
      if (!WORKSPACE_SPECIFIC_FIELDS.includes(k) && k !== 'workspaceSettings') {
        // @ts-ignore
        updatedGlobal[k] = migratedSettings[k];
      }
    });

    // Explicit check to ensure modeModelSettings is preserved if present
    if (migratedSettings.modeModelSettings) {
      updatedGlobal.modeModelSettings = migratedSettings.modeModelSettings;
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
        if (field in migratedSettings) {
          // @ts-ignore
          updatedGlobal[field] = migratedSettings[field];
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