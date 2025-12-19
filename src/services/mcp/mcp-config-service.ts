/**
 * MCP Config Service - Manages .echode/mcp.json configuration
 * Implements Single Responsibility Principle - only handles config persistence
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { MCPServerConfig } from './mcp-config-types';

export class MCPConfigService {
  private configPath: string | null = null;
  private watchers: vscode.FileSystemWatcher[] = [];

  constructor() {
    this.initializePath();
  }

  private initializePath() {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      this.configPath = path.join(rootPath, '.echode', 'mcp.json');
    }
  }

  /**
   * Ensure .echode directory and mcp.json exist
   */
  private async ensureConfigExists(): Promise<void> {
    if (!this.configPath) {
      this.initializePath();
      if (!this.configPath) {
        throw new Error('No workspace folder open');
      }
    }

    const dirPath = path.dirname(this.configPath);
    if (!fs.existsSync(dirPath)) {
      await fs.promises.mkdir(dirPath, { recursive: true });
    }

    if (!fs.existsSync(this.configPath)) {
      const defaultConfig = {
        mcpServers: {}
      };
      await fs.promises.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
    }
  }

  /**
   * Load MCP configurations from file
   */
  async loadConfigs(): Promise<MCPServerConfig[]> {
    try {
      if (!this.configPath) {
        this.initializePath();
        if (!this.configPath) {
          return [];
        }
      }

      if (!fs.existsSync(this.configPath)) {
        return [];
      }

      const content = await fs.promises.readFile(this.configPath, 'utf8');
      const parsed = JSON.parse(content);

      if (!parsed.mcpServers) {
        return [];
      }

      return this.parseConfigs(parsed.mcpServers);
    } catch (error) {
      console.error('Failed to load MCP config:', error);
      return [];
    }
  }

  /**
   * Save MCP configurations to file
   */
  async saveConfig(config: MCPServerConfig): Promise<void> {
    await this.ensureConfigExists();
    if (!this.configPath) return;

    const content = await fs.promises.readFile(this.configPath, 'utf8');
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { mcpServers: {} };
    }

    if (!parsed.mcpServers) {
      parsed.mcpServers = {};
    }

    // Convert config back to JSON format
    parsed.mcpServers[config.name] = this.configToJson(config);

    await fs.promises.writeFile(this.configPath, JSON.stringify(parsed, null, 2), 'utf8');
  }

  /**
   * Delete MCP configuration
   */
  async deleteConfig(serverId: string): Promise<void> {
    if (!this.configPath || !fs.existsSync(this.configPath)) return;

    const content = await fs.promises.readFile(this.configPath, 'utf8');
    const parsed = JSON.parse(content);

    if (parsed.mcpServers) {
      // Find key by matching generated ID logic or name
      // Since we don't store ID in JSON, we need to find the entry that matches
      // This is a simplification; ideally we'd store ID or match by name
      // For now, let's assume serverId passed in is connected to a config we can find
      // But wait, the UI passes ID. We need to map ID to name.
      
      // We'll iterate and check generated IDs
      const keys = Object.keys(parsed.mcpServers);
      for (const key of keys) {
        const id = `mcp-${key.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
        if (id === serverId) {
          delete parsed.mcpServers[key];
          break;
        }
      }

      await fs.promises.writeFile(this.configPath, JSON.stringify(parsed, null, 2), 'utf8');
    }
  }

  /**
   * Watch for changes to the config file
   */
  watchConfig(callback: () => void): vscode.Disposable {
    if (!this.configPath) return { dispose: () => {} };

    const watcher = vscode.workspace.createFileSystemWatcher(this.configPath);
    const disposable = watcher.onDidChange(() => callback());
    this.watchers.push(watcher);
    
    return {
      dispose: () => {
        disposable.dispose();
        watcher.dispose();
      }
    };
  }

  // Helper to parse JSON format to internal config objects
  private parseConfigs(mcpServers: any): MCPServerConfig[] {
    const configs: MCPServerConfig[] = [];
    
    for (const [key, value] of Object.entries(mcpServers)) {
      const config = value as any;
      const id = `mcp-${key.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
      
      // Determine type
      let type: "stdio" | "http" = "stdio";
      if (config.type) {
        type = config.type;
      } else if (config.url) {
        type = "http";
      }

      configs.push({
        id,
        name: config.name || key,
        type,
        command: config.command,
        args: config.args,
        env: config.env,
        url: config.url,
        headers: config.headers,
        authorization_token: config.authorization_token, // Handle specific auth token field
        description: config.description,
        tool_configuration: config.tool_configuration,
        enabled: config.tool_configuration?.enabled ?? true,
        autoConnect: true // Default to auto-connect
      });
    }

    return configs;
  }

  // Helper to convert internal config object to JSON format
  private configToJson(config: MCPServerConfig): any {
    const base: any = {
      name: config.name,
      type: config.type,
      description: config.description,
      tool_configuration: {
        enabled: config.enabled,
        allowed_tools: config.tool_configuration?.allowed_tools
      }
    };

    if (config.type === 'stdio') {
      base.command = config.command;
      base.args = config.args;
      if (config.env) base.env = config.env;
    } else {
      base.url = config.url;
      if (config.headers) base.headers = config.headers;
      if (config.authorization_token) base.authorization_token = config.authorization_token;
    }

    return base;
  }
}