import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ApiSettings {
  provider: string;
  customBaseUrl?: string;
  anthropicCustomUrl?: string;
  openaiCustomUrl?: string;
  openaiCompatibleCustomUrl?: string;
  megallmCustomUrl?: string;
  apiKey: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  openaiCompatibleApiKey?: string;
  megallmApiKey?: string;
  qwenCodeOauthPath?: string;
  model: string;
  anthropicModel?: string;
  openaiModel?: string;
  openaiCompatibleModel?: string;
  megallmModel?: string;
  vscodeLmModel?: string;
  qwenCodeModel?: string;
  anthropicMaxTokens: number;
  openaiMaxTokens: number;
  openaiCompatibleMaxTokens: number;
  megallmMaxTokens: number;
  vscodeLmMaxTokens: number;
  qwenCodeMaxTokens: number;
  anthropicTemperature: number;
  openaiTemperature: number;
  openaiCompatibleTemperature: number;
  megallmTemperature: number;
  vscodeLmTemperature: number;
  qwenCodeTemperature: number;
  streamingTimeout: number;
  systemPrompt?: string;
  enabledTools?: unknown[];
  chatMode?: string;
  workspaceModes?: Record<string, string>;
  workspaceSettings?: Record<string, Partial<ApiSettings>>;
  indexingSettings?: unknown;
  autocompleteSettings?: unknown;
  contextSettings?: unknown;
  commitMessageSettings?: unknown;
}

const DEFAULT_SETTINGS: ApiSettings = {
  provider: 'anthropic',
  customBaseUrl: '',
  anthropicCustomUrl: '',
  openaiCustomUrl: '',
  openaiCompatibleCustomUrl: '',
  megallmCustomUrl: '',
  apiKey: '',
  anthropicApiKey: '',
  openaiApiKey: '',
  openaiCompatibleApiKey: '',
  megallmApiKey: '',
  qwenCodeOauthPath: '',
  model: '',
  anthropicMaxTokens: 8192,
  openaiMaxTokens: 4096,
  openaiCompatibleMaxTokens: 4096,
  megallmMaxTokens: 4096,
  vscodeLmMaxTokens: 4096,
  qwenCodeMaxTokens: 65536,
  anthropicTemperature: 0.0,
  openaiTemperature: 0.0,
  openaiCompatibleTemperature: 0.0,
  megallmTemperature: 0.0,
  vscodeLmTemperature: 1.0,
  qwenCodeTemperature: 0.0,
  streamingTimeout: 5000,
  systemPrompt: '',
};

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
      // Merge workspace-specific overrides on top of global settings
      return {
        ...globalSettings,
        ...globalSettings.workspaceSettings[workspaceId]
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

    // 1. Identify model-related fields that should be workspace-specific
    const workspaceSpecificFields: (keyof ApiSettings)[] = [
      'provider',
      'model',
      'anthropicModel',
      'openaiModel',
      'openaiCompatibleModel',
      'megallmModel',
      'vscodeLmModel',
      'qwenCodeModel',
      'anthropicMaxTokens',
      'openaiMaxTokens',
      'openaiCompatibleMaxTokens',
      'megallmMaxTokens',
      'vscodeLmMaxTokens',
      'qwenCodeMaxTokens',
      'anthropicTemperature',
      'openaiTemperature',
      'openaiCompatibleTemperature',
      'megallmTemperature',
      'vscodeLmTemperature',
      'qwenCodeTemperature'
    ];

    // 2. Prepare the workspace override object
    const workspaceOverride: Partial<ApiSettings> = {};
    workspaceSpecificFields.forEach(field => {
      if (field in newSettings) {
        // @ts-ignore
        workspaceOverride[field] = newSettings[field];
      }
    });

    // 3. Prepare the updated global settings
    // We update global settings with EVERYTHING to ensure:
    // - API keys are saved
    // - Global defaults are updated (last write wins for global default)
    // - User expects their last used settings to persist when opening a new window
    const updatedGlobal: ApiSettings = {
      ...globalSettings,
      ...newSettings,
      // Ensure the workspaceSettings map is preserved/initialized
      workspaceSettings: globalSettings.workspaceSettings || {}
    };

    // 4. Save the workspace override if we are in a workspace
    if (workspacePath) {
      if (!updatedGlobal.workspaceSettings) {
        updatedGlobal.workspaceSettings = {};
      }
      updatedGlobal.workspaceSettings[workspaceId] = workspaceOverride;
    }

    this.saveSettings(updatedGlobal);
  }

  /**
   * Get chat mode for a specific workspace
   * Falls back to global chatMode or 'agent' default
   */
  getChatMode(workspacePath?: string): string {
    const settings = this.getSettings();
    const workspaceId = this.generateWorkspaceId(workspacePath);
    
    // Check workspace-specific mode first
    if (settings.workspaceModes && settings.workspaceModes[workspaceId]) {
      return settings.workspaceModes[workspaceId];
    }
    
    // Fall back to global chatMode or default
    return settings.chatMode || 'agent';
  }

  /**
   * Set chat mode for a specific workspace
   */
  setChatMode(workspacePath: string | undefined, mode: string): void {
    const settings = this.getSettings();
    const workspaceId = this.generateWorkspaceId(workspacePath);
    
    // Initialize workspaceModes if not exists
    if (!settings.workspaceModes) {
      settings.workspaceModes = {};
    }
    
    settings.workspaceModes[workspaceId] = mode;
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
