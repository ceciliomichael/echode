import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface EchodeConfig {
  maxSessionsPerWorkspace: number;
  historyDir: string;
}

const DEFAULT_CONFIG: EchodeConfig = {
  maxSessionsPerWorkspace: 100,
  historyDir: path.join(os.homedir(), '.echode', 'history'),
};

export class ConfigService {
  private configDir: string;
  private configPath: string;
  private config: EchodeConfig | null = null;

  constructor() {
    this.configDir = path.join(os.homedir(), '.echode');
    this.configPath = path.join(this.configDir, 'config.json');
    this.ensureConfigDirectory();
  }

  private ensureConfigDirectory(): void {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
    } catch (error) {
      console.error('[ConfigService] Failed to create config directory:', error);
    }
  }

  getConfig(): EchodeConfig {
    if (this.config) {
      return this.config;
    }

    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(data) as Partial<EchodeConfig>;
        this.config = { ...DEFAULT_CONFIG, ...parsed };
      } else {
        this.config = { ...DEFAULT_CONFIG };
        this.saveConfig(this.config);
      }
    } catch (error) {
      console.error('[ConfigService] Failed to read config:', error);
      this.config = { ...DEFAULT_CONFIG };
    }

    return this.config;
  }

  saveConfig(config: EchodeConfig): void {
    try {
      const tmpPath = this.configPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.configPath);
      this.config = config;
    } catch (error) {
      console.error('[ConfigService] Failed to save config:', error);
      throw error;
    }
  }

  updateConfig(updates: Partial<EchodeConfig>): void {
    const current = this.getConfig();
    const updated = { ...current, ...updates };
    this.saveConfig(updated);
  }

  getConfigPath(): string {
    return this.configPath;
  }

  dispose(): void {
    this.config = null;
  }
}

// Singleton instance
let configServiceInstance: ConfigService | null = null;

export function getConfigService(): ConfigService {
  if (!configServiceInstance) {
    configServiceInstance = new ConfigService();
  }
  return configServiceInstance;
}
