/**
 * MCP Config Adapter - Transforms raw JSON configs to internal MCPServerConfig format
 * 
 * Follows Single Responsibility Principle:
 * - Only handles data transformation between external JSON format and internal types
 * - Separated from file I/O concerns (handled by MCPConfigService)
 */

import { MCPServerConfig, MCPTransportType, ConfigSource } from './mcp-config-types';
import { ServerConfig } from './mcp-validation';
import { getWorkspacePath } from '../../utils/path-utils';

/**
 * Generate a consistent server ID from name
 * Creates a normalized, URL-safe identifier
 */
export function generateServerId(name: string): string {
  return `mcp-${name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
}

/**
 * Convert validated server configs to MCPServerConfig format
 * 
 * @param mcpServers - Record of server name to raw ServerConfig from JSON
 * @param source - Whether config comes from 'global' or 'project' location
 * @returns Array of normalized MCPServerConfig objects
 */
export function convertToMCPServerConfigs(
  mcpServers: Record<string, ServerConfig>,
  source: ConfigSource
): MCPServerConfig[] {
  const configs: MCPServerConfig[] = [];

  for (const [name, config] of Object.entries(mcpServers)) {
    const id = generateServerId(name);
    
    // Determine transport type based on config type field
    let type: MCPTransportType = 'stdio';
    if (config.type === 'sse' || config.type === 'streamable-http') {
      type = 'http';
    }

    const serverConfig: MCPServerConfig = {
      id,
      name,
      type,
      enabled: !config.disabled,
      // autoConnect is managed separately by MCPStateService
      // Default to true for enabled servers (will be overridden by state service)
      autoConnect: !config.disabled,
      
      // Source tracking for project-specific configs
      ...(source === 'project' && { 
        source,
        projectPath: getWorkspacePath() 
      }),
    };

    // Add stdio-specific fields
    if (config.type === 'stdio') {
      serverConfig.command = config.command;
      serverConfig.args = config.args;
      serverConfig.env = config.env;
    }

    // Add HTTP-specific fields (SSE/streamable-http)
    if (config.type === 'sse' || config.type === 'streamable-http') {
      serverConfig.url = config.url;
      serverConfig.headers = config.headers;
    }

    // Add tool configuration if any tools are explicitly allowed/disabled
    if (config.alwaysAllow?.length || config.disabledTools?.length) {
      serverConfig.tool_configuration = {
        enabled: true,
        allowed_tools: config.alwaysAllow,
        disabled_tools: config.disabledTools,
      };
    }

    configs.push(serverConfig);
  }

  return configs;
}