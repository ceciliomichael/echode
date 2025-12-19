/**
 * MCP Types for UI
 * Shared types for MCP components
 */

export type MCPTransportType = "stdio" | "http";

export interface MCPToolConfiguration {
  enabled: boolean;
  allowed_tools?: string[];
}

export interface MCPServerConfig {
  id: string;
  name: string;
  type: MCPTransportType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  authorization_token?: string;
  description?: string;
  tool_configuration?: MCPToolConfiguration;
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