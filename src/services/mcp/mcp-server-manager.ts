/**
 * MCP Server Manager - Manages multiple MCP server connections
 * Implements Dependency Inversion - depends on abstractions (MCPClient)
 * Follows Single Responsibility - only manages server lifecycle
 */

import * as vscode from 'vscode';
import { MCPClient } from './mcp-client';
import { MCPServerConfig, MCPServerStatus } from './mcp-config-types';
import { MCPTool, MCPTransport } from './mcp-types';
import { MCPConfigService } from './mcp-config-service';
import { MCPTransportFactory } from './mcp-transport-factory';
import { ToolRegistry } from '../tools/tool-registry';
import { ITool } from '../tools/tool.interface';
import { MCPToolAdapter } from './mcp-tool-adapter';
import { getSettingsService } from '../settings-service';

/**
 * Manages lifecycle of MCP server connections
 */
export class MCPServerManager {
  private servers = new Map<
    string,
    {
      config: MCPServerConfig;
      client: MCPClient | null;
      status: MCPServerStatus;
      tools: MCPTool[];
    }
  >();
  
  private configService: MCPConfigService;
  private toolRegistry: ToolRegistry;
  private statusChangeEmitter = new vscode.EventEmitter<MCPServerStatus>();
  private configChangeEmitter = new vscode.EventEmitter<MCPServerConfig[]>();
  
  public onStatusChange = this.statusChangeEmitter.event;
  public onConfigChange = this.configChangeEmitter.event;

  constructor(toolRegistry: ToolRegistry, context: vscode.ExtensionContext) {
    const storagePath = context.globalStorageUri.fsPath;
    this.configService = new MCPConfigService(storagePath);
    this.toolRegistry = toolRegistry;
    this.initialize();
  }

  private async initialize() {
    // Watch for config changes
    this.configService.watchConfig(async () => {
      await this.refreshConfigs();
    });

    // Initial load
    await this.refreshConfigs();
  }

  /**
   * Get the current workspace path for workspace-specific settings
   */
  private getWorkspacePath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    return workspaceFolders && workspaceFolders.length > 0
      ? workspaceFolders[0].uri.fsPath
      : undefined;
  }

  /**
   * Apply workspace-specific MCP server overrides to configs
   * This allows enabling/disabling MCP servers per workspace
   */
  private applyWorkspaceOverrides(configs: MCPServerConfig[]): MCPServerConfig[] {
    const workspacePath = this.getWorkspacePath();
    const effectiveSettings = getSettingsService().getEffectiveSettings(workspacePath);
    const overrides = effectiveSettings.mcpServerOverrides;

    if (!overrides) {
      return configs;
    }

    return configs.map(config => {
      const override = overrides[config.id];
      if (override !== undefined) {
        return {
          ...config,
          enabled: override.enabled,
        };
      }
      return config;
    });
  }

  private async refreshConfigs() {
    const rawConfigs = await this.configService.loadConfigs();
    
    // Apply workspace-specific overrides (enabled/disabled per workspace)
    const configs = this.applyWorkspaceOverrides(rawConfigs);
    
    // Emit config change event for UI updates (with overrides applied)
    this.configChangeEmitter.fire(configs);
    
    // Connect to new auto-connect servers
    for (const config of configs) {
      if (!this.servers.has(config.id) && config.autoConnect && config.enabled) {
        this.connect(config).catch(console.error);
      } else if (this.servers.has(config.id)) {
        // Update existing config
        const server = this.servers.get(config.id)!;
        server.config = config;
        
        // If disabled, disconnect
        if (!config.enabled && server.status.status === 'connected') {
          this.disconnect(config.id);
        }
      }
    }
  }

  /**
   * Connect to an MCP server
   */
  async connect(config: MCPServerConfig): Promise<void> {
    // If already connected, check if it's actually connected or in error state
    if (this.servers.has(config.id)) {
      const existingServer = this.servers.get(config.id);

      // If connected successfully, just return without error
      if (existingServer?.status.status === "connected") {
        return;
      }

      // If in error or connecting state, disconnect first and retry
      if (
        existingServer?.status.status === "error" ||
        existingServer?.status.status === "connecting"
      ) {
        await this.disconnect(config.id).catch(() => {
          this.servers.delete(config.id);
        });
      }
    }

    const status: MCPServerStatus = {
      serverId: config.id,
      status: "connecting",
    };
    this.updateStatus(status);

    try {
      // Create appropriate transport based on config
      const transport = MCPTransportFactory.createTransport(config);
      const client = new MCPClient(transport);

      // Initialize the connection
      await client.initialize();

      // List available tools
      const toolsResponse = await client.listTools();

      // Update status
      status.status = "connected";
      status.connectedAt = Date.now();
      status.toolCount = toolsResponse.tools.length;
      status.tools = toolsResponse.tools;
      
      // Store server info
      this.servers.set(config.id, {
        config,
        client,
        status,
        tools: toolsResponse.tools,
      });

      this.updateStatus(status);

      // Register tools
      this.registerTools(client, toolsResponse.tools, config.name);

    } catch (error) {
      status.status = "error";
      status.error = error instanceof Error ? error.message : "Unknown error";
      this.updateStatus(status);

      // Store error state
      this.servers.set(config.id, {
        config,
        client: null,
        status,
        tools: [],
      });

      throw error;
    }
  }

  private updateStatus(status: MCPServerStatus) {
    this.statusChangeEmitter.fire(status);
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnect(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      return; // Already disconnected or not found
    }

    // Unregister tools
    this.unregisterTools(serverId);

    if (server.client) {
      await server.client.close();
    }

    // Update status
    const status: MCPServerStatus = {
        serverId,
        status: "disconnected"
    };
    this.updateStatus(status);
    
    this.servers.delete(serverId);
  }

  /**
   * Register MCP tools with the main registry
   */
  private registerTools(client: MCPClient, tools: MCPTool[], source: string) {
    // Get config for this source/server
    // Since we don't have the config object passed here easily without changing signature,
    // we'll find it by name or we should have passed it.
    // Ideally, connect() passed the config to us.
    // Let's modify the signature or look it up? 
    // Wait, 'source' argument is 'config.name' passed from connect()
    
    // We need the full config to check allowed/disabled tools.
    // We can find the server by looking at this.servers values.
    const serverEntry = Array.from(this.servers.values()).find(s => s.config.name === source);
    const config = serverEntry?.config;

    for (const tool of tools) {
      // Check if tool is allowed/disabled
      if (config?.tool_configuration) {
        const { allowed_tools, disabled_tools } = config.tool_configuration;
        
        // If allowed_tools is set, tool MUST be in it
        if (allowed_tools && allowed_tools.length > 0 && !allowed_tools.includes(tool.name)) {
          continue;
        }

        // If disabled_tools is set, tool MUST NOT be in it
        if (disabled_tools && disabled_tools.includes(tool.name)) {
          continue;
        }
      }

      const adapter = new MCPToolAdapter(tool, client, source);
      this.toolRegistry.registerTool(adapter);
    }
  }

  /**
   * Unregister tools for a specific server (by source name mostly, but we need to track them)
   * Since ToolRegistry doesn't support unregistering easily by source, 
   * we might need to enhance ToolRegistry or carefuly name them.
   * For now, we'll assume we can't easily remove them without registry support,
   * OR we implement a disable mechanism.
   * 
   * Actually, ToolRegistry has a map. We can delete by key.
   * But we need to know the keys.
   */
  private unregisterTools(serverId: string) {
    const server = this.servers.get(serverId);
    if (!server) {
      return;
    }
    
    // Tools are registered with their name. 
    // If names collide, we have an issue, but standard MCP tools should be unique enough or namespaced.
    // Ideally we'd namespace them: "server:tool"
    
    // For now, let's remove by name
    for (const tool of server.tools) {
         this.toolRegistry.unregisterTool(`mcp_${tool.name}`);
    }
  }

  /**
   * Get all server statuses
   */
  getAllStatuses(): MCPServerStatus[] {
    return Array.from(this.servers.values()).map((server) => server.status);
  }

  /**
   * Get all tools from connected servers
   */
  getAllConnectedTools(): MCPTool[] {
    const allTools: MCPTool[] = [];
    for (const server of this.servers.values()) {
      if (server.status.status === 'connected') {
        const prefixedTools = server.tools.map(tool => ({
          ...tool,
          name: `mcp_${tool.name}`
        }));
        allTools.push(...prefixedTools);
      }
    }
    return allTools;
  }
  
  /**
   * Get all configs
   */
  async getConfigs(): Promise<MCPServerConfig[]> {
      return this.configService.loadConfigs();
  }

  /**
   * Get server configuration
   */
  getConfig(serverId: string): MCPServerConfig | undefined {
    return this.servers.get(serverId)?.config;
  }

  /**
   * Save a config
   */
  async saveConfig(config: MCPServerConfig): Promise<void> {
      await this.configService.saveConfig(config);
      // Auto-reconnect/connect if needed
      await this.refreshConfigs();
  }
  
  /**
   * Delete a config
   */
  async deleteConfig(serverId: string): Promise<void> {
      await this.disconnect(serverId);
      await this.configService.deleteConfig(serverId);
  }

  /**
   * Toggle a tool enabled/disabled state
   */
  async toggleTool(serverId: string, toolName: string, enabled: boolean): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      return;
    }

    const config = server.config;

    if (!config.tool_configuration) {
      config.tool_configuration = { enabled: true };
    }
    
    if (!config.tool_configuration.disabled_tools) {
      config.tool_configuration.disabled_tools = [];
    }

    if (enabled) {
      // Remove from disabled list
      config.tool_configuration.disabled_tools = config.tool_configuration.disabled_tools.filter(t => t !== toolName);
      // Register the tool if we have a client
      if (server.client) {
        const tool = server.tools.find(t => t.name === toolName);
        if (tool) {
          const adapter = new MCPToolAdapter(tool, server.client, config.name);
          this.toolRegistry.registerTool(adapter);
        }
      }
    } else {
      // Add to disabled list if not present
      if (!config.tool_configuration.disabled_tools.includes(toolName)) {
        config.tool_configuration.disabled_tools.push(toolName);
      }
      // Unregister the tool
      this.toolRegistry.unregisterTool(`mcp_${toolName}`);
    }

    // Save config (no reconnect needed)
    await this.configService.saveConfig(config);
  }

  /**
   * Disconnect all servers
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.servers.keys()).map((serverId) =>
      this.disconnect(serverId).catch(() => {}),
    );
    await Promise.all(disconnectPromises);
  }

  /**
   * Get the config file path
   */
  getConfigPath(): string | null {
    return this.configService.getConfigPath();
  }

  /**
   * Ensure config file exists
   */
  async ensureConfigExists(): Promise<void> {
    await this.configService.ensureConfigExists();
  }
}

// Global instance
let globalServerManager: MCPServerManager | null = null;

export function getGlobalServerManager(
  toolRegistry?: ToolRegistry,
  context?: vscode.ExtensionContext
): MCPServerManager {
  if (!globalServerManager && toolRegistry && context) {
    globalServerManager = new MCPServerManager(toolRegistry, context);
  } else if (!globalServerManager) {
    throw new Error("Server Manager not initialized");
  }
  return globalServerManager;
}