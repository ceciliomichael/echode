import {
  ChevronDown,
  ChevronUp,
  Power,
  Server,
} from "lucide-react";
import { useState } from "react";
import type {
  MCPServerConfig,
  MCPServerStatus,
} from "./types";

interface MCPServerCardProps {
  config: MCPServerConfig;
  status?: MCPServerStatus;
  onConnect: (config: MCPServerConfig) => void;
  onDisconnect: (serverId: string) => void;
  onToggleTool?: (serverId: string, toolName: string, enabled: boolean) => void;
}

export function MCPServerCard({
  config,
  status,
  onConnect,
  onDisconnect,
  onToggleTool,
}: MCPServerCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const isConnected = status?.status === "connected";
  const isConnecting = status?.status === "connecting";
  const hasError = status?.status === "error";

  const getStatusColor = () => {
    if (isConnected) return "bg-green-500";
    if (isConnecting) return "bg-yellow-500";
    if (hasError) return "bg-red-500";
    return "bg-neutral-400";
  };

  const getStatusText = () => {
    if (isConnected) return "Connected";
    if (isConnecting) return "Connecting...";
    if (hasError) return "Error";
    return "Disconnected";
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4 overflow-hidden min-w-0" style={{ borderColor: 'var(--vscode-widget-border)', backgroundColor: 'var(--vscode-editor-background)' }}>
      <div className="flex items-start justify-between min-w-0">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="rounded-lg p-2 shrink-0" style={{ backgroundColor: 'var(--vscode-toolbar-hoverBackground)' }}>
            <Server className="h-5 w-5" style={{ color: 'var(--vscode-foreground)' }} />
          </div>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <h3 className="font-medium text-sm break-words" style={{ color: 'var(--vscode-foreground)' }}>{config.name}</h3>
            {config.description && (
              <p className="text-xs break-words" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                {config.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <div className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
              <span className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                {getStatusText()}
              </span>
              {status?.toolCount !== undefined && isConnected && (
                <span className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                  • {status.toolCount} tools
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Toggle Connect/Disconnect */}
        <button
          type="button"
          onClick={() => isConnected ? onDisconnect(config.id) : onConnect(config)}
          disabled={isConnecting || !config.enabled}
          className="flex items-center gap-1.5 min-h-[28px] rounded-xl px-2.5 py-1 text-xs font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          style={{ 
            backgroundColor: isConnected ? 'var(--vscode-button-secondaryBackground)' : 'var(--vscode-button-background)', 
            color: isConnected ? 'var(--vscode-button-secondaryForeground)' : 'var(--vscode-button-foreground)',
            borderColor: 'var(--vscode-button-border)'
          }}
        >
          <Power className="h-3.5 w-3.5" />
          {isConnecting ? "Connecting..." : isConnected ? "Disconnect" : "Connect"}
        </button>
      </div>

      {hasError && status?.error && (
        <div className="rounded-lg px-3 py-2 text-xs break-words overflow-hidden" style={{ backgroundColor: 'var(--vscode-inputValidation-errorBackground)', color: 'var(--vscode-inputValidation-errorForeground)', border: '1px solid var(--vscode-inputValidation-errorBorder)' }}>
          {status.error}
        </div>
      )}

      {/* Collapsible Details */}
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-1 text-xs hover:opacity-80"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {showDetails ? "Hide details" : "Show details"}
      </button>

      {showDetails && (
        <div className="flex flex-col gap-2 text-xs min-w-0 pt-2 border-t" style={{ color: 'var(--vscode-descriptionForeground)', borderColor: 'var(--vscode-widget-border)' }}>
          {/* Transport Type Badge */}
          <div className="flex items-center gap-2">
            <span className="shrink-0">Type:</span>
            <span className="rounded px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'var(--vscode-badge-background)', color: 'var(--vscode-badge-foreground)' }}>
              {config.type.toUpperCase()}
            </span>
          </div>

          {/* Stdio Transport Details */}
          {config.type === "stdio" && config.command && (
            <>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="shrink-0">Command:</span>
                <code className="rounded-md px-2 py-1 break-all overflow-hidden w-full" style={{ backgroundColor: 'var(--vscode-textBlockQuote-background)' }}>
                  {config.command}
                </code>
              </div>
              {config.args && config.args.length > 0 && (
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="shrink-0">Args:</span>
                  <code className="rounded px-2 py-1 break-all whitespace-pre-wrap overflow-hidden w-full" style={{ backgroundColor: 'var(--vscode-textBlockQuote-background)' }}>
                    {config.args.join(" ")}
                  </code>
                </div>
              )}
            </>
          )}

          {/* HTTP/SSE Transport Details */}
          {config.type === "http" && config.url && (
            <div className="flex flex-col gap-1 min-w-0">
              <span className="shrink-0">URL:</span>
              <code className="rounded-md px-2 py-1 break-all overflow-hidden w-full" style={{ backgroundColor: 'var(--vscode-textBlockQuote-background)' }}>
                {config.url}
              </code>
            </div>
          )}

          {/* Tool count info when connected */}
          {isConnected && (
            <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--vscode-widget-border)' }}>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--vscode-foreground)' }}>
                Available Tools ({status?.toolCount || 0})
              </p>
              
              {status?.tools && status.tools.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {status.tools.map((tool) => {
                    const isEnabled = !config.tool_configuration?.disabled_tools?.includes(tool.name);
                    return (
                      <button
                        key={tool.name}
                        type="button"
                        onClick={() => onToggleTool?.(config.id, tool.name, !isEnabled)}
                        disabled={!onToggleTool}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                        style={{
                          backgroundColor: isEnabled 
                            ? 'var(--vscode-button-background)' 
                            : 'var(--vscode-input-background)',
                          color: isEnabled 
                            ? 'var(--vscode-button-foreground)' 
                            : 'var(--vscode-disabledForeground)',
                          border: `1px solid ${isEnabled ? 'var(--vscode-button-background)' : 'var(--vscode-input-border)'}`,
                          cursor: 'pointer',
                          opacity: isEnabled ? 1 : 0.6
                        }}
                        title={tool.description || tool.name}
                      >
                        {tool.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                  No tools found on this server.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}