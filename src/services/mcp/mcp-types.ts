/**
 * MCP protocol types and interfaces
 * Based on Model Context Protocol specification
 */

/**
 * JSON-RPC 2.0 Request
 */
export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown> | unknown[];
}

/**
 * JSON-RPC 2.0 Response
 */
export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: JSONRPCError;
}

/**
 * JSON-RPC 2.0 Error
 */
export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * JSON-RPC 2.0 Notification (no id, no response expected)
 */
export interface JSONRPCNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown> | unknown[];
}

/**
 * MCP Tool Schema (from list_tools response)
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, MCPToolParameter>;
    required?: string[];
  };
}

/**
 * MCP Tool Parameter Schema
 */
export interface MCPToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: MCPToolParameter;
  properties?: Record<string, MCPToolParameter>;
}

/**
 * MCP Tools List Response
 */
export interface MCPListToolsResponse {
  tools: MCPTool[];
}

/**
 * MCP Tool Call Request Parameters
 */
export interface MCPCallToolParams {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * MCP Tool Call Response
 */
export interface MCPCallToolResponse {
  content: MCPContent[];
  isError?: boolean;
}

/**
 * MCP Content Types
 */
export type MCPContent = MCPTextContent | MCPImageContent | MCPResourceContent;

export interface MCPTextContent {
  type: "text";
  text: string;
}

export interface MCPImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export interface MCPResourceContent {
  type: "resource";
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
  };
}

/**
 * MCP Initialize Request Parameters
 */
export interface MCPInitializeParams {
  protocolVersion: string;
  capabilities: {
    roots?: {
      listChanged?: boolean;
    };
    sampling?: Record<string, unknown>;
  };
  clientInfo: {
    name: string;
    version: string;
  };
}

/**
 * MCP Initialize Response
 */
export interface MCPInitializeResponse {
  protocolVersion: string;
  capabilities: {
    tools?: {
      listChanged?: boolean;
    };
    resources?: {
      subscribe?: boolean;
      listChanged?: boolean;
    };
    prompts?: {
      listChanged?: boolean;
    };
    logging?: Record<string, unknown>;
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

/**
 * Transport interface for MCP communication
 */
export interface MCPTransport {
  send(message: JSONRPCRequest | JSONRPCNotification): Promise<void>;
  onMessage(
    handler: (message: JSONRPCResponse | JSONRPCNotification) => void,
  ): void;
  onError(handler: (error: Error) => void): void;
  onClose(handler: () => void): void;
  close(): Promise<void>;
}