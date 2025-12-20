import type {
  MCPServerConfig,
  MCPServerStatus,
} from "./types";
import { MCPServerCard } from "./mcp-server-card";

interface MCPServerListProps {
  configs: MCPServerConfig[];
  statuses: Record<string, MCPServerStatus>;
  onConnect: (config: MCPServerConfig) => void;
  onDisconnect: (serverId: string) => void;
  onToggleTool: (serverId: string, toolName: string, enabled: boolean) => void;
}

export function MCPServerList({
  configs,
  statuses,
  onConnect,
  onDisconnect,
  onToggleTool,
}: MCPServerListProps) {
  if (configs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-12 px-4" style={{ borderColor: 'var(--vscode-widget-border)', backgroundColor: 'var(--vscode-editor-background)' }}>
        <p className="text-sm" style={{ color: 'var(--vscode-foreground)' }}>No MCP servers configured</p>
        <p className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          Click "Edit Configuration" to add servers
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {configs.map((config) => (
        <MCPServerCard
          key={config.id}
          config={config}
          status={statuses[config.id]}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onToggleTool={onToggleTool}
        />
      ))}
    </div>
  );
}