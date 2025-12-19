import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Power,
  RefreshCw,
  Server,
  Trash2,
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
  onDelete: (serverId: string) => void;
  onRefresh: (serverId: string) => void;
  onEdit: (config: MCPServerConfig) => void;
}

export function MCPServerCard({
  config,
  status,
  onConnect,
  onDisconnect,
  onDelete,
  onRefresh,
  onEdit,
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
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 overflow-hidden min-w-0" style={{ borderColor: 'var(--vscode-widget-border)', backgroundColor: 'var(--vscode-editor-background)' }}>
      <div className="flex items-start justify-between min-w-0">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="rounded-lg bg-neutral-100 p-2 shrink-0" style={{ backgroundColor: 'var(--vscode-toolbar-hoverBackground)' }}>
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
      </div>

      {hasError && status?.error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 break-words overflow-hidden" style={{ backgroundColor: 'var(--vscode-inputValidation-errorBackground)', color: 'var(--vscode-inputValidation-errorForeground)', border: '1px solid var(--vscode-inputValidation-errorBorder)' }}>
          {status.error}
        </div>
      )}

      <div className="flex flex-col gap-2 text-xs min-w-0" style={{ color: 'var(--vscode-descriptionForeground)' }}>
        {/* Transport Type Badge */}
        <div className="flex items-center gap-2">
          <span className="shrink-0">Type:</span>
          <span className="rounded px-2 py-1 text-xs font-medium" style={{ backgroundColor: 'var(--vscode-badge-background)', color: 'var(--vscode-badge-foreground)' }}>
            {config.type.toUpperCase()}
          </span>
        </div>

        {/* Stdio Transport Details */}
        {config.type === "stdio" && config.command && (
          <>
            <div className="flex flex-col gap-1 min-w-0">
              <span className="shrink-0">Command:</span>
              <code className="rounded px-2 py-1 break-all overflow-hidden w-full" style={{ backgroundColor: 'var(--vscode-textBlockQuote-background)' }}>
                {config.command}
              </code>
            </div>
            {config.args && config.args.length > 0 && (
              <div className="flex flex-col gap-1 min-w-0">
                <span className="shrink-0">Args:</span>
                <code className="rounded px-2 py-1 break-all overflow-wrap-anywhere whitespace-pre-wrap overflow-hidden w-full" style={{ backgroundColor: 'var(--vscode-textBlockQuote-background)' }}>
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
            <code className="rounded px-2 py-1 break-all overflow-hidden w-full" style={{ backgroundColor: 'var(--vscode-textBlockQuote-background)' }}>
              {config.url}
            </code>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        {!isConnected && !isConnecting && (
          <button
            type="button"
            onClick={() => onConnect(config)}
            disabled={!config.enabled}
            className="flex items-center gap-2 min-h-[32px] rounded-sm px-3 py-1 text-xs font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)' }}
          >
            <Power className="h-3.5 w-3.5" />
            Connect
          </button>
        )}
        {isConnected && (
          <>
            <button
              type="button"
              onClick={() => onDisconnect(config.id)}
              className="flex items-center gap-2 min-h-[32px] rounded-sm border px-3 py-1 text-xs font-medium hover:bg-neutral-50"
              style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', borderColor: 'var(--vscode-button-border)' }}
            >
              <Power className="h-3.5 w-3.5" />
              Disconnect
            </button>
            <button
              type="button"
              onClick={() => onRefresh(config.id)}
              className="flex items-center gap-2 min-h-[32px] rounded-sm border px-3 py-1 text-xs font-medium hover:bg-neutral-50"
              style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', borderColor: 'var(--vscode-button-border)' }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 min-h-[32px] rounded-sm border px-3 py-1 text-xs font-medium hover:bg-neutral-50"
              style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', borderColor: 'var(--vscode-button-border)' }}
            >
              {showDetails ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {showDetails ? "Hide" : "Show"} Tools
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => onEdit(config)}
          className="flex items-center gap-2 min-h-[32px] rounded-sm border px-3 py-1 text-xs font-medium hover:bg-neutral-50"
          style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', borderColor: 'var(--vscode-button-border)' }}
          title="Edit server configuration"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(config.id)}
          className="ml-auto flex items-center gap-2 min-h-[32px] rounded-sm border px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-errorForeground)', borderColor: 'var(--vscode-button-border)' }}
          title={
            isConnected ? "Will disconnect before deleting" : "Delete server"
          }
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>

      {/* Tool Details - shown when expanded and connected */}
      {showDetails && isConnected && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--vscode-widget-border)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--vscode-foreground)' }}>
            Available Tools ({status?.toolCount || 0})
          </p>
          <p className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            Tools from this server can be enabled/disabled in the chat input
            tool dropdown.
          </p>
        </div>
      )}
    </div>
  );
}