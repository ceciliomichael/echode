import { spawn } from 'child_process';
import { MCPServerConfig } from './mcp-config-types';
import { HttpTransport } from './mcp-http-transport';
import { StdioTransport } from './mcp-transport';
import { MCPTransport } from './mcp-types';

/**
 * Factory for creating MCP transports based on configuration
 * Follows Single Responsibility Principle by isolating creation logic
 */
export class MCPTransportFactory {
  /**
   * Create transport based on config
   */
  static createTransport(config: MCPServerConfig): MCPTransport {
    if (config.type === "http") {
      // HTTP/SSE transport
      if (!config.url) {
        throw new Error("HTTP transport requires url configuration");
      }
      return new HttpTransport(config.url, {
        headers: config.headers,
      });
    } else if (config.type === "stdio") {
      // Stdio transport
      if (!config.command || !config.args) {
        throw new Error("Stdio transport requires command and args");
      }

      // On Windows, npm/npx/pnpm/yarn commands need .cmd extension
      const isWindows = process.platform === "win32";
      const needsCmdExtension = ["npx", "npm", "pnpm", "yarn"].includes(
        config.command,
      );
      const command =
        isWindows && needsCmdExtension
          ? `${config.command}.cmd`
          : config.command;
      
      // Prepare env - merge with process.env but careful with strict extensions
      const env = { ...process.env, ...config.env };

      console.log(`[MCP] Spawning command: ${command} with args:`, config.args);

      // Spawn the MCP server process
      // Note: We avoid shell: true to prevent argument escaping issues on Windows
      // unless strictly necessary. For node/python scripts, direct spawn is safer.
      const serverProcess = spawn(command, config.args, {
        env,
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      });

      return new StdioTransport(serverProcess);
    } else {
      throw new Error(
        // @ts-ignore - config.type might be unknown at runtime
        `Invalid transport type: ${config.type}. Must be "stdio" or "http"`,
      );
    }
  }
}