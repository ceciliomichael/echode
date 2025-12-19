/**
 * Configuration types for MCP server management
 * Following Single Responsibility Principle - only config-related types
 * Matches official MCP server configuration schema
 */

export type MCPTransportType = "stdio" | "http";

/**
 * Tool configuration for MCP servers
 */
export interface MCPToolConfiguration {
  enabled: boolean;
  allowed_tools?: string[];
}

/**
 * MCP Server Configuration
 * Supports both stdio and http (SSE) transports
 */
export interface MCPServerConfig {
  // Internal ID (for our app)
  id: string;

  // Server name (from JSON config key)
  name: string;

  // Transport type: "stdio" for local processes, "http" for SSE servers
  type: MCPTransportType;

  // For stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;

  // For HTTP/SSE transport
  url?: string;
  headers?: Record<string, string>;
  authorization_token?: string;

  // Optional fields
  description?: string;
  tool_configuration?: MCPToolConfiguration;

  // Internal state management
  enabled: boolean;
  autoConnect: boolean;
}

export interface MCPServerStatus {
  serverId: string;
  status: "connected" | "disconnected" | "connecting" | "error";
  error?: string;
  connectedAt?: number;
  toolCount?: number;
}

export interface MCPConnectionLog {
  serverId: string;
  timestamp: number;
  type: "info" | "error" | "warning";
  message: string;
}