/**
 * MCP Config Service - Manages mcp.json configuration with dual-source support
 * 
 * Configuration locations:
 * - Global config: ~/.echode/mcp/mcp.json (user's home folder)
 * - Project config: {workspace}/.echode/mcp/mcp.json
 * - Project configs override global configs with the same name
 * - File watching with debouncing for both sources
 * - Zod validation for all configurations
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import deepEqual from 'fast-deep-equal';

import { MCPServerConfig, MCPTransportType, ConfigSource, MCPServerConfigWithSource } from './mcp-config-types';
import { 
  McpSettingsSchema, 
  ServerConfig, 
  parseMcpSettings,
  validateServerConfig 
} from './mcp-validation';
import { safeWriteJson, fileExistsAtPath } from './utils/filesystem';
import { getWorkspacePath } from '../../utils/path-utils';
import { convertToMCPServerConfigs, generateServerId } from './mcp-config-adapter';

// Default MCP settings file content
const DEFAULT_MCP_SETTINGS = {
  mcpServers: {}
};

// Config directory structure: .echode/mcp/
const ECHODE_DIR = '.echode';
const MCP_SUBDIR = 'mcp';
const MCP_CONFIG_FILENAME = 'mcp.json';

/**
 * Get the global MCP config directory path (~/.echode/mcp/)
 */
function getGlobalMcpDir(): string {
  return path.join(os.homedir(), ECHODE_DIR, MCP_SUBDIR);
}

/**
 * Get the global MCP config file path (~/.echode/mcp/mcp.json)
 */
function getGlobalMcpConfigPath(): string {
  return path.join(getGlobalMcpDir(), MCP_CONFIG_FILENAME);
}

export class MCPConfigService {
  private globalConfigPath: string;
  private disposables: vscode.Disposable[] = [];
  
  // File watchers
  private globalWatcher?: vscode.FileSystemWatcher;
  private projectWatcher?: vscode.FileSystemWatcher;
  
  // Debounce timers for config changes
  private configChangeTimers = new Map<string, NodeJS.Timeout>();
  
  // Flag to prevent watcher triggering during programmatic updates
  private isProgrammaticUpdate = false;
  private flagResetTimer?: NodeJS.Timeout;
  
  // Event emitters
  private configChangeEmitter = new vscode.EventEmitter<MCPServerConfig[]>();
  public onConfigChange = this.configChangeEmitter.event;

  constructor() {
    // Use ~/.echode/mcp/mcp.json for global config
    this.globalConfigPath = getGlobalMcpConfigPath();
  }

  /**
   * Initialize the config service and set up watchers
   */
  async initialize(): Promise<void> {
    await this.ensureGlobalConfigExists();
    this.watchGlobalConfig();
    await this.watchProjectConfig();
    this.setupWorkspaceFoldersWatcher();
  }

  /**
   * Get the global config file path
   */
  getGlobalConfigPath(): string {
    return this.globalConfigPath;
  }

  /**
   * Get the project config file path ({workspace}/.echode/mcp/mcp.json)
   */
  async getProjectConfigPath(): Promise<string | null> {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
      return null;
    }

    const projectConfigPath = path.join(workspacePath, ECHODE_DIR, MCP_SUBDIR, MCP_CONFIG_FILENAME);
    
    try {
      await fs.access(projectConfigPath);
      return projectConfigPath;
    } catch {
      return null;
    }
  }

  /**
   * Ensure global ~/.echode/mcp/ directory and mcp.json exist
   */
  async ensureGlobalConfigExists(): Promise<void> {
    const dirPath = path.dirname(this.globalConfigPath);
    
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch {
      // Directory might already exist
    }

    if (!await fileExistsAtPath(this.globalConfigPath)) {
      await safeWriteJson(this.globalConfigPath, DEFAULT_MCP_SETTINGS);
    }
  }

  /**
   * Watch global MCP settings file for changes
   */
  private watchGlobalConfig(): void {
    if (!this.globalConfigPath || process.env.NODE_ENV === 'test') {
      return;
    }

    // Clean up existing watcher
    if (this.globalWatcher) {
      this.globalWatcher.dispose();
      this.globalWatcher = undefined;
    }

    const settingsDir = path.dirname(this.globalConfigPath);
    const settingsFile = path.basename(this.globalConfigPath);
    const pattern = new vscode.RelativePattern(settingsDir, settingsFile);

    this.globalWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    const changeHandler = (uri: vscode.Uri) => {
      this.debounceConfigChange(uri.fsPath, 'global');
    };

    this.disposables.push(
      this.globalWatcher.onDidChange(changeHandler),
      this.globalWatcher.onDidCreate(changeHandler),
      this.globalWatcher
    );
  }

  /**
   * Watch project-level .echode/mcp/mcp.json for changes
   */
  private async watchProjectConfig(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    // Clean up existing watcher
    if (this.projectWatcher) {
      this.projectWatcher.dispose();
      this.projectWatcher = undefined;
    }

    if (!vscode.workspace.workspaceFolders?.length) {
      return;
    }

    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
      return;
    }

    const projectPattern = new vscode.RelativePattern(
      workspacePath, 
      `${ECHODE_DIR}/${MCP_SUBDIR}/${MCP_CONFIG_FILENAME}`
    );

    this.projectWatcher = vscode.workspace.createFileSystemWatcher(projectPattern);

    // Watch for changes
    const changeDisposable = this.projectWatcher.onDidChange((uri) => {
      this.debounceConfigChange(uri.fsPath, 'project');
    });

    // Watch for creation
    const createDisposable = this.projectWatcher.onDidCreate((uri) => {
      this.debounceConfigChange(uri.fsPath, 'project');
    });

    // Watch for deletion
    const deleteDisposable = this.projectWatcher.onDidDelete(async () => {
      // Clean up project configs when file is deleted
      await this.handleProjectConfigDeleted();
    });

    this.disposables.push(
      vscode.Disposable.from(changeDisposable, createDisposable, deleteDisposable, this.projectWatcher)
    );
  }

  /**
   * Set up watcher for workspace folder changes
   */
  private setupWorkspaceFoldersWatcher(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        await this.watchProjectConfig();
        await this.notifyConfigChange();
      })
    );
  }

  /**
   * Debounce config file change handling
   */
  private debounceConfigChange(filePath: string, source: ConfigSource): void {
    // Skip if this is a programmatic update
    if (this.isProgrammaticUpdate) {
      return;
    }

    const key = `${source}-${filePath}`;

    // Clear existing timer
    const existingTimer = this.configChangeTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounced timer
    const timer = setTimeout(async () => {
      this.configChangeTimers.delete(key);
      await this.handleConfigFileChange(filePath, source);
    }, 500);

    this.configChangeTimers.set(key, timer);
  }

  /**
   * Handle config file change after debounce
   */
  private async handleConfigFileChange(filePath: string, source: ConfigSource): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parseResult = parseMcpSettings(content);

      if (!parseResult.success) {
        vscode.window.showErrorMessage(
          `Invalid MCP settings in ${source} config: ${parseResult.error}`
        );
        return;
      }

      await this.notifyConfigChange();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' && source === 'project') {
        await this.handleProjectConfigDeleted();
      } else {
        console.error(`Failed to handle ${source} config change:`, error);
      }
    }
  }

  /**
   * Handle project config file deletion
   */
  private async handleProjectConfigDeleted(): Promise<void> {
    vscode.window.showInformationMessage('Project MCP configuration deleted');
    await this.notifyConfigChange();
  }

  /**
   * Notify listeners of config change
   */
  private async notifyConfigChange(): Promise<void> {
    const configs = await this.loadConfigs();
    this.configChangeEmitter.fire(configs);
  }

  /**
   * Load and merge MCP configurations from both sources.
   * Project configs override global configs with the same name.
   */
  async loadConfigs(): Promise<MCPServerConfig[]> {
    const globalConfigs = await this.loadConfigsFromSource('global');
    const projectConfigs = await this.loadConfigsFromSource('project');

    // Merge: project overrides global by name
    const configsByName = new Map<string, MCPServerConfig>();

    // Add global configs first
    for (const config of globalConfigs) {
      configsByName.set(config.name, config);
    }

    // Override with project configs
    for (const config of projectConfigs) {
      configsByName.set(config.name, config);
    }

    return Array.from(configsByName.values());
  }

  /**
   * Load configs from a specific source
   */
  private async loadConfigsFromSource(source: ConfigSource): Promise<MCPServerConfig[]> {
    try {
      let configPath: string | null;
      
      if (source === 'global') {
        configPath = this.globalConfigPath;
      } else {
        configPath = await this.getProjectConfigPath();
      }

      if (!configPath || !await fileExistsAtPath(configPath)) {
        return [];
      }

      const content = await fs.readFile(configPath, 'utf-8');
      const parseResult = parseMcpSettings(content);

      if (!parseResult.success || !parseResult.data) {
        console.error(`Failed to parse ${source} MCP config:`, parseResult.error);
        return [];
      }

      return convertToMCPServerConfigs(parseResult.data.mcpServers, source);
    } catch (error) {
      console.error(`Failed to load ${source} MCP config:`, error);
      return [];
    }
  }

  /**
   * Save MCP configuration to the appropriate file
   * By default saves to global, unless the server is explicitly from project
   */
  async saveConfig(config: MCPServerConfig, targetSource?: ConfigSource): Promise<void> {
    // Determine target source
    const source = targetSource ?? this.determineConfigSource(config);
    
    let configPath: string | null;
    if (source === 'project') {
      configPath = await this.getOrCreateProjectConfigPath();
    } else {
      await this.ensureGlobalConfigExists();
      configPath = this.globalConfigPath;
    }

    if (!configPath) {
      throw new Error('Unable to determine config file path');
    }

    // Set programmatic update flag
    this.setProgrammaticUpdateFlag();

    try {
      // Read existing config
      let existingConfig: { mcpServers: Record<string, unknown> } = { mcpServers: {} };
      if (await fileExistsAtPath(configPath)) {
        const content = await fs.readFile(configPath, 'utf-8');
        try {
          existingConfig = JSON.parse(content);
        } catch {
          existingConfig = { mcpServers: {} };
        }
      }

      if (!existingConfig.mcpServers) {
        existingConfig.mcpServers = {};
      }

      // Convert config to JSON format
      existingConfig.mcpServers[config.name] = this.configToJsonFormat(config);

      await safeWriteJson(configPath, existingConfig);
    } finally {
      // Flag will be reset by timer
    }
  }

  /**
   * Set the programmatic update flag to prevent watcher loops
   */
  private setProgrammaticUpdateFlag(): void {
    if (this.flagResetTimer) {
      clearTimeout(this.flagResetTimer);
    }
    
    this.isProgrammaticUpdate = true;
    
    this.flagResetTimer = setTimeout(() => {
      this.isProgrammaticUpdate = false;
      this.flagResetTimer = undefined;
    }, 600);
  }

  /**
   * Determine which config source a server belongs to
   */
  private determineConfigSource(config: MCPServerConfig): ConfigSource {
    // Check if config has source property (from extended type)
    const extendedConfig = config as MCPServerConfigWithSource;
    if (extendedConfig.source === 'project') {
      return 'project';
    }
    return 'global';
  }

  /**
   * Get or create project config path ({workspace}/.echode/mcp/mcp.json)
   */
  private async getOrCreateProjectConfigPath(): Promise<string | null> {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
      return null;
    }

    const projectConfigDir = path.join(workspacePath, ECHODE_DIR, MCP_SUBDIR);
    const projectConfigPath = path.join(projectConfigDir, MCP_CONFIG_FILENAME);

    // Create directory if needed
    try {
      await fs.mkdir(projectConfigDir, { recursive: true });
    } catch {
      // Directory might already exist
    }

    // Create default config if file doesn't exist
    if (!await fileExistsAtPath(projectConfigPath)) {
      await safeWriteJson(projectConfigPath, DEFAULT_MCP_SETTINGS);
    }

    return projectConfigPath;
  }

  /**
   * Convert MCPServerConfig to JSON format for saving
   */
  private configToJsonFormat(config: MCPServerConfig): Record<string, unknown> {
    const jsonConfig: Record<string, unknown> = {};

    // Set type based on transport
    if (config.type === 'stdio') {
      jsonConfig.type = 'stdio';
      jsonConfig.command = config.command;
      if (config.args) {
        jsonConfig.args = config.args;
      }
      if (config.env) {
        jsonConfig.env = config.env;
      }
    } else {
      // HTTP types (sse or streamable-http)
      jsonConfig.type = 'sse'; // Default to SSE for HTTP
      jsonConfig.url = config.url;
      if (config.headers) {
        jsonConfig.headers = config.headers;
      }
    }

    // Disabled state
    if (!config.enabled) {
      jsonConfig.disabled = true;
    }

    // Tool configuration
    if (config.tool_configuration) {
      if (config.tool_configuration.allowed_tools?.length) {
        jsonConfig.alwaysAllow = config.tool_configuration.allowed_tools;
      }
      if (config.tool_configuration.disabled_tools?.length) {
        jsonConfig.disabledTools = config.tool_configuration.disabled_tools;
      }
    }

    return jsonConfig;
  }

  /**
   * Delete MCP configuration
   */
  async deleteConfig(serverId: string): Promise<void> {
    // Try to delete from both sources
    await this.deleteConfigFromSource(serverId, 'global');
    await this.deleteConfigFromSource(serverId, 'project');
  }

  /**
   * Delete config from a specific source
   */
  private async deleteConfigFromSource(serverId: string, source: ConfigSource): Promise<void> {
    let configPath: string | null;
    
    if (source === 'global') {
      configPath = this.globalConfigPath;
    } else {
      configPath = await this.getProjectConfigPath();
    }

    if (!configPath || !await fileExistsAtPath(configPath)) {
      return;
    }

    this.setProgrammaticUpdateFlag();

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      if (config.mcpServers) {
        // Find key by matching generated ID
        for (const key of Object.keys(config.mcpServers)) {
          const id = generateServerId(key);
          if (id === serverId) {
            delete config.mcpServers[key];
            await safeWriteJson(configPath, config);
            break;
          }
        }
      }
    } catch (error) {
      console.error(`Failed to delete config from ${source}:`, error);
    }
  }

  /**
   * Watch for changes to the config file (legacy API compatibility)
   */
  watchConfig(callback: () => void): vscode.Disposable {
    const disposable = this.onConfigChange(() => callback());
    return disposable;
  }

  /**
   * Get the config file path (legacy API - returns global path)
   */
  getConfigPath(): string | null {
    return this.globalConfigPath;
  }

  /**
   * Ensure config file exists (legacy API)
   */
  async ensureConfigExists(): Promise<void> {
    return this.ensureGlobalConfigExists();
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    // Clear all debounce timers
    for (const timer of this.configChangeTimers.values()) {
      clearTimeout(timer);
    }
    this.configChangeTimers.clear();

    // Clear flag reset timer
    if (this.flagResetTimer) {
      clearTimeout(this.flagResetTimer);
      this.flagResetTimer = undefined;
    }

    // Dispose watchers
    if (this.globalWatcher) {
      this.globalWatcher.dispose();
    }
    if (this.projectWatcher) {
      this.projectWatcher.dispose();
    }

    // Dispose all disposables
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];

    // Dispose emitter
    this.configChangeEmitter.dispose();
  }
}