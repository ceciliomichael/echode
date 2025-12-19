/**
 * MCP Client - Manages connection to a single MCP server
 * Implements Open/Closed Principle - extensible without modification
 */

import {
  JSONRPCNotification,
  JSONRPCRequest,
  JSONRPCResponse,
  MCPCallToolParams,
  MCPCallToolResponse,
  MCPInitializeParams,
  MCPInitializeResponse,
  MCPListToolsResponse,
  MCPTransport,
} from './mcp-types';

/**
 * MCP Client for communicating with an MCP server
 */
export class MCPClient {
  private transport: MCPTransport;
  private nextRequestId = 1;
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();
  private isInitialized = false;
  private serverInfo?: {
    name: string;
    version: string;
    capabilities: unknown;
  };

  constructor(transport: MCPTransport) {
    this.transport = transport;
    this.setupTransportHandlers();
  }

  private setupTransportHandlers(): void {
    this.transport.onMessage((message) => {
      this.handleMessage(message);
    });

    this.transport.onError((error) => {
      // Reject all pending requests
      for (const [id, handlers] of this.pendingRequests) {
        handlers.reject(error);
        this.pendingRequests.delete(id);
      }
    });

    this.transport.onClose(() => {
      this.isInitialized = false;
      // Reject all pending requests
      for (const [id, handlers] of this.pendingRequests) {
        handlers.reject(new Error("Connection closed"));
        this.pendingRequests.delete(id);
      }
    });
  }

  private handleMessage(message: JSONRPCResponse | JSONRPCNotification): void {
    // Check if it's a response (has id)
    if ("id" in message) {
      const response = message as JSONRPCResponse;
      const handlers = this.pendingRequests.get(response.id);

      if (handlers) {
        this.pendingRequests.delete(response.id);

        if (response.error) {
          handlers.reject(
            new Error(
              `JSON-RPC Error ${response.error.code}: ${response.error.message}`,
            ),
          );
        } else {
          handlers.resolve(response.result);
        }
      }
    } else {
      // It's a notification - silently ignore for now
    }
  }

  private async sendRequest(
    method: string,
    params?: Record<string, unknown> | unknown[],
  ): Promise<unknown> {
    const id = this.nextRequestId++;
    const request: JSONRPCRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      this.transport.send(request).catch((error) => {
        this.pendingRequests.delete(id);
        reject(error);
      });

      // Set timeout for request (30 seconds)
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout for method: ${method}`));
        }
      }, 30000);
    });
  }

  /**
   * Initialize the MCP connection
   */
  async initialize(): Promise<MCPInitializeResponse> {
    const params: MCPInitializeParams = {
      protocolVersion: "2024-11-05",
      capabilities: {
        roots: {
          listChanged: true,
        },
      },
      clientInfo: {
        name: "Echode",
        version: "1.0.0",
      },
    };

    const result = (await this.sendRequest(
      "initialize",
      params as unknown as Record<string, unknown>,
    )) as MCPInitializeResponse;

    this.isInitialized = true;
    this.serverInfo = {
      name: result.serverInfo.name,
      version: result.serverInfo.version,
      capabilities: result.capabilities,
    };

    // Send initialized notification
    await this.transport.send({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    return result;
  }

  /**
   * List all available tools from the server
   */
  async listTools(): Promise<MCPListToolsResponse> {
    if (!this.isInitialized) {
      throw new Error("Client not initialized. Call initialize() first.");
    }

    const result = (await this.sendRequest(
      "tools/list",
    )) as MCPListToolsResponse;
    return result;
  }

  /**
   * Call a tool on the server
   */
  async callTool(params: MCPCallToolParams): Promise<MCPCallToolResponse> {
    if (!this.isInitialized) {
      throw new Error("Client not initialized. Call initialize() first.");
    }

    const result = (await this.sendRequest(
      "tools/call",
      params as unknown as Record<string, unknown>,
    )) as MCPCallToolResponse;
    return result;
  }

  /**
   * Get server information
   */
  getServerInfo():
    | { name: string; version: string; capabilities: unknown }
    | undefined {
    return this.serverInfo;
  }

  /**
   * Check if client is initialized
   */
  isConnected(): boolean {
    return this.isInitialized;
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    await this.transport.close();
    this.isInitialized = false;
  }
}