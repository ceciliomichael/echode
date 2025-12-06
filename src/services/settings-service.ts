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
  indexingSettings?: unknown;
  autocompleteSettings?: unknown;
  contextSettings?: unknown;
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
  streamingTimeout: 10000,
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
