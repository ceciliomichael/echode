/**
 * MCP Transport Layer - Handles JSON-RPC communication over stdio
 * Implements Single Responsibility Principle - only transport logic
 */

import { ChildProcess } from 'child_process';
import {
  JSONRPCNotification,
  JSONRPCRequest,
  JSONRPCResponse,
  MCPTransport,
} from './mcp-types';

/**
 * StdioTransport - Manages JSON-RPC communication over stdio with a child process
 */
export class StdioTransport implements MCPTransport {
  private process: ChildProcess;
  private messageHandler?: (
    message: JSONRPCResponse | JSONRPCNotification,
  ) => void;
  private errorHandler?: (error: Error) => void;
  private closeHandler?: () => void;
  private buffer = "";
  private stderrBuffer = "";
  private isClosed = false;

  constructor(process: ChildProcess) {
    this.process = process;
    this.setupListeners();
  }

  private setupListeners(): void {
    // Handle stdout data (JSON-RPC messages)
    this.process.stdout?.on("data", (data: Buffer) => {
      this.handleData(data);
    });

    // Handle stderr (log messages from server)
    this.process.stderr?.on("data", (data: Buffer) => {
      this.stderrBuffer += data.toString();
      // Also log to console for debugging
      console.error(`[MCP Stderr] ${data.toString()}`);
    });

    // Handle process errors
    this.process.on("error", (error: Error) => {
      this.errorHandler?.(error);
    });

    // Handle process exit
    this.process.on("close", (code: number | null) => {
      this.isClosed = true;
      if (code !== 0 && code !== null) {
        const errorMessage = `Process exited with code ${code}. Stderr: ${this.stderrBuffer}`;
        this.errorHandler?.(new Error(errorMessage));
      } else {
        this.closeHandler?.();
      }
    });
  }

  private handleData(data: Buffer): void {
    // Append to buffer
    this.buffer += data.toString();

    // Process complete JSON-RPC messages (newline-delimited)
    const lines = this.buffer.split("\n");
    // Keep the last incomplete line in buffer
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      try {
        const message = JSON.parse(trimmed) as
          | JSONRPCResponse
          | JSONRPCNotification;
        this.messageHandler?.(message);
      } catch (error) {
        this.errorHandler?.(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }
  }

  async send(message: JSONRPCRequest | JSONRPCNotification): Promise<void> {
    if (this.isClosed) {
      throw new Error("Transport is closed");
    }

    if (!this.process.stdin) {
      throw new Error("Process stdin is not available");
    }

    const json = JSON.stringify(message);
    return new Promise((resolve, reject) => {
      this.process.stdin?.write(`${json}\n`, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
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

    // Send SIGTERM to gracefully shutdown the process
    this.process.kill("SIGTERM");

    // Wait for process to exit, or force kill after timeout
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (!this.process.killed) {
          this.process.kill("SIGKILL");
        }
        resolve();
      }, 5000); // 5 second timeout

      this.process.once("close", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
}