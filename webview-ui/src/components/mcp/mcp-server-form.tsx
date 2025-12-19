import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from "lucide-react";
import { useState } from "react";
import type { MCPServerConfig } from "./types";

interface MCPServerFormProps {
  initialConfigs?: MCPServerConfig[];
  onSubmit: (configs: MCPServerConfig[]) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

// JSON config format types
interface StdioServerConfig {
  name: string;
  type: "stdio";
  command: string;
  args: string[];
  env?: Record<string, string>;
  description?: string;
  tool_configuration?: {
    enabled: boolean;
    allowed_tools?: string[];
  };
}

interface HttpServerConfig {
  name: string;
  type: "http";
  url: string;
  headers?: Record<string, string>;
  authorization_token?: string;
  description?: string;
  tool_configuration?: {
    enabled: boolean;
    allowed_tools?: string[];
  };
}

type JsonServerConfig = StdioServerConfig | HttpServerConfig;

export function MCPServerForm({
  initialConfigs = [],
  onSubmit,
  onCancel,
  isEditing = false,
}: MCPServerFormProps) {
  // Convert existing configs to the MCP JSON format
  const configsToJson = (configs: MCPServerConfig[]) => {
    const mcpServers: Record<string, JsonServerConfig> = {};
    for (const config of configs) {
      if (config.type === "http") {
        const serverConfig: HttpServerConfig = {
          name: config.name,
          type: "http",
          url: config.url || "",
        };
        if (config.headers && Object.keys(config.headers).length > 0) {
          serverConfig.headers = config.headers;
        }
        if (config.authorization_token) {
          serverConfig.authorization_token = config.authorization_token;
        }
        if (config.description) {
          serverConfig.description = config.description;
        }
        if (config.tool_configuration) {
          serverConfig.tool_configuration = config.tool_configuration;
        }
        mcpServers[config.name] = serverConfig;
      } else {
        const serverConfig: StdioServerConfig = {
          name: config.name,
          type: "stdio",
          command: config.command || "",
          args: config.args || [],
        };
        if (config.env && Object.keys(config.env).length > 0) {
          serverConfig.env = config.env;
        }
        if (config.description) {
          serverConfig.description = config.description;
        }
        if (config.tool_configuration) {
          serverConfig.tool_configuration = config.tool_configuration;
        }
        mcpServers[config.name] = serverConfig;
      }
    }
    return JSON.stringify({ mcpServers }, null, 2);
  };

  const [jsonText, setJsonText] = useState(
    initialConfigs.length > 0
      ? configsToJson(initialConfigs)
      : '{\n  "mcpServers": {\n    "example-stdio": {\n      "name": "Example Stdio Server",\n      "type": "stdio",\n      "command": "node",\n      "args": ["path/to/server.js"]\n    },\n    "example-http": {\n      "name": "Example HTTP Server",\n      "type": "http",\n      "url": "http://api.example.com/mcp"\n    }\n  }\n}',
  );
  const [error, setError] = useState<string>("");
  const [showStdioExample, setShowStdioExample] = useState<boolean>(false);
  const [showHttpExample, setShowHttpExample] = useState<boolean>(false);
  const [fullHeight, setFullHeight] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      // Parse JSON
      const parsed = JSON.parse(jsonText);

      // Validate structure
      if (!parsed.mcpServers || typeof parsed.mcpServers !== "object") {
        throw new Error('JSON must contain an "mcpServers" object');
      }

      // Convert to MCPServerConfig array
      const configs: MCPServerConfig[] = [];
      for (const [serverKey, serverConfig] of Object.entries(
        parsed.mcpServers,
      )) {
        // Type guard for server config
        const config = serverConfig as Partial<JsonServerConfig> &
          Record<string, unknown>;

        // Determine server ID
        // If editing, preserve the original ID; otherwise generate deterministic ID
        const serverId =
          isEditing && initialConfigs.length > 0
            ? initialConfigs[0].id
            : `mcp-${serverKey.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;

        // Get server name - either from "name" field or use the key
        const serverName =
          typeof config.name === "string" ? config.name : serverKey;

        // Determine transport type and validate
        const transportType =
          config.type ||
          (config.url ? "http" : config.command ? "stdio" : undefined);

        if (!transportType) {
          throw new Error(
            `Server "${serverKey}" must have a "type" field ("stdio" or "http")`,
          );
        }

        if (transportType === "http") {
          // HTTP/SSE transport
          if (!config.url || typeof config.url !== "string") {
            throw new Error(
              `Server "${serverKey}" must have "url" (string) for HTTP transport`,
            );
          }

          const baseHeaders =
            typeof config.headers === "object" && config.headers !== null
              ? (config.headers as Record<string, string>)
              : {};
          const headers = { ...baseHeaders };
          if (
            typeof config.authorization_token === "string" &&
            !headers.Authorization
          ) {
            headers.Authorization = `Bearer ${config.authorization_token}`;
          }

          configs.push({
            id: serverId,
            name: serverName,
            type: "http",
            url: config.url,
            headers: Object.keys(headers).length > 0 ? headers : undefined,
            authorization_token:
              typeof config.authorization_token === "string"
                ? config.authorization_token
                : undefined,
            description:
              typeof config.description === "string"
                ? config.description
                : `MCP HTTP server: ${serverName}`,
            tool_configuration: config.tool_configuration,
            enabled:
              isEditing && initialConfigs.length > 0
                ? initialConfigs[0].enabled
                : true,
            autoConnect:
              isEditing && initialConfigs.length > 0
                ? initialConfigs[0].autoConnect
                : true,
          });
        } else if (transportType === "stdio") {
          // Stdio transport
          if (
            !config.command ||
            typeof config.command !== "string" ||
            !Array.isArray(config.args)
          ) {
            throw new Error(
              `Server "${serverKey}" must have "command" (string) and "args" (array) for stdio transport`,
            );
          }

          const envVars =
            typeof config.env === "object" && config.env !== null
              ? (config.env as Record<string, string>)
              : {};

          configs.push({
            id: serverId,
            name: serverName,
            type: "stdio",
            command: config.command,
            args: config.args,
            env: envVars,
            description:
              typeof config.description === "string"
                ? config.description
                : `MCP stdio server: ${serverName}`,
            tool_configuration: config.tool_configuration,
            enabled:
              isEditing && initialConfigs.length > 0
                ? initialConfigs[0].enabled
                : true,
            autoConnect:
              isEditing && initialConfigs.length > 0
                ? initialConfigs[0].autoConnect
                : true,
          });
        } else {
          throw new Error(
            `Server "${serverKey}" has invalid type "${transportType}". Must be "stdio" or "http"`,
          );
        }
      }

      if (configs.length === 0) {
        throw new Error("No servers found in configuration");
      }

      onSubmit(configs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4 pb-4">
        {!fullHeight && (
          <div className="flex flex-col gap-2">
            <label
              htmlFor="json-config"
              className="text-sm font-semibold"
              style={{ color: 'var(--vscode-foreground)' }}
            >
              MCP Server Configuration (JSON)
            </label>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--vscode-descriptionForeground)' }}>
              Paste your MCP server configuration below. Supports both stdio
              (local) and HTTP (remote) MCP servers.
            </p>
            <div className="text-xs p-2 rounded border border-yellow-200 bg-yellow-50 text-yellow-800" style={{ borderColor: 'var(--vscode-editorWarning-foreground)', color: 'var(--vscode-editorWarning-foreground)', backgroundColor: 'var(--vscode-editor-background)' }}>
              <strong>Tip for Windows users:</strong> Use forward slashes <code>/</code> for paths (e.g., <code>C:/path/to/file</code>) or double backslashes <code>\\</code> (e.g., <code>C:\\path\\to\\file</code>) to avoid JSON errors.
            </div>
          </div>
        )}

        <div
          className={`flex flex-col flex-1 min-h-0 overflow-hidden rounded-lg border shadow-sm`}
          style={{ borderColor: 'var(--vscode-widget-border)', backgroundColor: 'var(--vscode-editor-background)' }}
        >
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-1.5 border-b rounded-t-lg" style={{ borderColor: 'var(--vscode-widget-border)', backgroundColor: 'var(--vscode-toolbar-hoverBackground)' }}>
            <span className="text-sm font-medium truncate max-w-[200px]" style={{ color: 'var(--vscode-foreground)' }}>
              Configuration
            </span>
            <button
              type="button"
              onClick={() => setFullHeight(!fullHeight)}
              className="flex items-center justify-end p-1 outline-none min-h-[32.8px] min-w-[44px] ml-auto"
              title={fullHeight ? "Exit fullscreen" : "Fullscreen"}
              aria-label={fullHeight ? "Minimize" : "Maximize"}
            >
              {fullHeight ? (
                <Minimize2 className="w-3.5 h-3.5" style={{ color: 'var(--vscode-foreground)' }} />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" style={{ color: 'var(--vscode-foreground)' }} />
              )}
            </button>
          </div>

          {/* Editor content */}
          <div className="flex-1 overflow-hidden" style={{ backgroundColor: 'var(--vscode-editor-background)' }}>
            <textarea
              id="json-config"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              onFocus={() => {
                setShowStdioExample(false);
                setShowHttpExample(false);
              }}
              className={`w-full h-full px-4 py-3 text-sm font-mono leading-relaxed outline-none resize-none overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${
                fullHeight ? "" : "min-h-[300px]"
              }`}
              style={{ backgroundColor: 'var(--vscode-editor-background)', color: 'var(--vscode-editor-foreground)' }}
              placeholder='{\n  "mcpServers": {\n    "example": {\n      "command": "node",\n      "args": ["path/to/server.js"]\n    }\n  }\n}'
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg px-3 py-2 text-sm text-red-700" style={{ backgroundColor: 'var(--vscode-inputValidation-errorBackground)', color: 'var(--vscode-inputValidation-errorForeground)', border: '1px solid var(--vscode-inputValidation-errorBorder)' }}>
            {error}
          </div>
        )}

        {!fullHeight && (
          <div className="flex flex-col gap-3">
            {/* Stdio Server Example */}
            <div className="flex flex-col gap-0 rounded-lg border shadow-sm overflow-hidden" style={{ borderColor: 'var(--vscode-widget-border)' }}>
              <button
                type="button"
                onClick={() => {
                  setShowStdioExample(!showStdioExample);
                  if (!showStdioExample) setShowHttpExample(false);
                }}
                className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors duration-150 outline-none min-h-[44px]"
                style={{ backgroundColor: 'var(--vscode-editor-background)', color: 'var(--vscode-foreground)' }}
              >
                <span>Stdio Server Example</span>
                {showStdioExample ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showStdioExample && (
                <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--vscode-widget-border)' }}>
                  <pre className="text-xs overflow-x-auto rounded-md p-3 font-mono leading-relaxed mt-3" style={{ backgroundColor: 'var(--vscode-textBlockQuote-background)', color: 'var(--vscode-textBlockQuote-foreground)' }}>
                    {`{
  "mcpServers": {
    "my-stdio-server": {
      "name": "My Stdio Server",
      "type": "stdio",
      "command": "python",
      "args": ["-m", "my_mcp.server"],
      "env": { "MY_ENV_VAR": "some_value" },
      "description": "A server for managing file system tools.",
      "tool_configuration": {
        "enabled": true,
        "allowed_tools": ["filesystem/read", "filesystem/write"]
      }
    }
  }
}`}
                  </pre>
                </div>
              )}
            </div>

            {/* HTTP/SSE Server Example */}
            <div className="flex flex-col gap-0 rounded-lg border shadow-sm overflow-hidden" style={{ borderColor: 'var(--vscode-widget-border)' }}>
              <button
                type="button"
                onClick={() => {
                  setShowHttpExample(!showHttpExample);
                  if (!showHttpExample) setShowStdioExample(false);
                }}
                className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors duration-150 outline-none min-h-[44px]"
                style={{ backgroundColor: 'var(--vscode-editor-background)', color: 'var(--vscode-foreground)' }}
              >
                <span>HTTP/SSE Server Example</span>
                {showHttpExample ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showHttpExample && (
                <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--vscode-widget-border)' }}>
                  <pre className="text-xs overflow-x-auto rounded-md p-3 font-mono leading-relaxed mt-3" style={{ backgroundColor: 'var(--vscode-textBlockQuote-background)', color: 'var(--vscode-textBlockQuote-foreground)' }}>
                    {`{
  "mcpServers": {
    "my-sse-server": {
      "name": "My SSE Server",
      "type": "http",
      "url": "https://example.com/mcp/",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      },
      "description": "Remote server for accessing external APIs.",
      "authorization_token": "another_token_field",
      "tool_configuration": {
        "enabled": true
      }
    }
  }
}`}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t pt-4 pb-4 px-4 flex gap-3 shadow-sm" style={{ backgroundColor: 'var(--vscode-editor-background)', borderColor: 'var(--vscode-widget-border)' }}>
        <button
          type="submit"
          className="flex-1 min-h-[32px] rounded-sm px-4 py-2.5 text-sm font-medium shadow-sm hover:opacity-90"
          style={{ backgroundColor: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)' }}
        >
          {isEditing ? "Save Changes" : "Import Servers"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 min-h-[32px] rounded-sm border px-4 py-2.5 text-sm font-medium hover:bg-neutral-50"
          style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', borderColor: 'var(--vscode-button-border)' }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}