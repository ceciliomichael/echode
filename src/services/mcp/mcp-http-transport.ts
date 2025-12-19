/**
 * MCP HTTP Transport - Handles JSON-RPC communication over HTTP with SSE
 * Implements Single Responsibility Principle - only transport logic
 * Supports remote MCP servers exposed via HTTP endpoints
 */

import {
  JSONRPCNotification,
  JSONRPCRequest,
  JSONRPCResponse,
  MCPTransport,
} from './mcp-types';

/**
 * HttpTransport - Manages JSON-RPC communication over HTTP with SSE
 * Handles session management for MCP HTTP transport
 */
export class HttpTransport implements MCPTransport {
  private endpoint: string;
  private messageHandler?: (
    message: JSONRPCResponse | JSONRPCNotification,
  ) => void;
  private errorHandler?: (error: Error) => void;
  private closeHandler?: () => void;
  private isClosed = false;
  private sessionId?: string;
  private headers: Record<string, string>;
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: JSONRPCResponse) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor(
    endpoint: string,
    options?: {
      headers?: Record<string, string>;
      sessionId?: string;
    },
  ) {
    this.endpoint = endpoint.replace(/\/$/, ""); // Remove trailing slash
    this.headers = options?.headers || {};
    this.sessionId = options?.sessionId;
  }

  async send(message: JSONRPCRequest | JSONRPCNotification): Promise<void> {
    if (this.isClosed) {
      throw new Error("Transport is closed");
    }

    // Check if this is an initialize request
    const isInitialize = "method" in message && message.method === "initialize";

    try {
      // Build request headers
      const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...this.headers,
      };

      // Add session ID header if we have one (after initialization)
      if (this.sessionId && !isInitialize) {
        requestHeaders["mcp-session-id"] = this.sessionId;
      }

      // Send JSON-RPC message to HTTP endpoint with SSE support
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        // Try to get error details from response
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.text();
          if (errorData) {
            errorMessage += ` - ${errorData}`;
          }
        } catch {
          // Ignore if we can't read the error body
        }
        throw new Error(errorMessage);
      }

      // CRITICAL: Extract session ID from response header IMMEDIATELY
      if (isInitialize) {
        const sessionHeader =
          response.headers.get("MCP-Session-Id") ||
          response.headers.get("mcp-session-id") ||
          response.headers.get("Mcp-Session-Id");

        if (sessionHeader) {
          this.sessionId = sessionHeader;
        }
      }

      // Check content type to determine response handling
      const contentType = response.headers.get("content-type");

      // Try to detect response type even if content-type header is missing
      if (contentType?.includes("text/event-stream")) {
        // SSE response - parse event stream
        await this.handleSSEResponse(response);
      } else if (contentType?.includes("application/json")) {
        // Direct JSON response
        const data = (await response.json()) as JSONRPCResponse;

        // Validate JSON-RPC response
        if (!data.jsonrpc || data.jsonrpc !== "2.0") {
          throw new Error(
            "Invalid JSON-RPC response: missing or invalid jsonrpc field",
          );
        }

        // Handle response immediately
        if ("id" in message && message.id !== undefined) {
          this.messageHandler?.(data);
        }
      } else if (!contentType || contentType === "") {
        // No content type header - try to detect from response body
        // For MCP HTTP, missing content-type usually means SSE
        try {
          await this.handleSSEResponse(response);
        } catch (error) {
          throw new Error(
            `Response missing Content-Type header and failed to parse as SSE: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      } else {
        throw new Error(
          `Unexpected content type: ${contentType}. Expected application/json or text/event-stream`,
        );
      }
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error("Failed to send message");
      this.errorHandler?.(errorObj);
      throw errorObj;
    }
  }

  /**
   * Handle Server-Sent Events response stream
   */
  private async handleSSEResponse(response: Response): Promise<void> {
    if (!response.body) {
      throw new Error("No response body for SSE stream");
    }

    // Use specific type casting or any for compatibility with different fetch implementations
    const reader = (response.body as any).getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: false });

        // Process complete SSE messages
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        let eventData = "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            eventData += line.slice(6);
          } else if (line === "" || line === "\r") {
            // Empty line signals end of event
            if (eventData) {
              try {
                const message = JSON.parse(eventData) as
                  | JSONRPCResponse
                  | JSONRPCNotification;
                this.messageHandler?.(message);
              } catch (_error) {
                this.errorHandler?.(
                  new Error(`Failed to parse SSE message: ${eventData}`),
                );
              }
              eventData = "";
            }
          }
        }
      }
    } catch (error) {
      // Use specific error type
      const errorObj = error instanceof Error ? error : new Error("SSE stream error");
      this.errorHandler?.(errorObj);
      throw errorObj;
    } finally {
      // Release lock safely
      try {
        reader.releaseLock();
      } catch (e) {
        // Ignore errors on release
      }
    }
  }

  onMessage(
    handler: (message: JSONRPCResponse | JSONRPCNotification) => void,
  ): void {
    this.messageHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  async close(): Promise<void> {
    if (this.isClosed) {
      return;
    }

    this.isClosed = true;

    // Reject any pending requests
    for (const [id, handlers] of this.pendingRequests) {
      handlers.reject(new Error("Connection closed"));
      this.pendingRequests.delete(id);
    }

    this.closeHandler?.();
  }
}