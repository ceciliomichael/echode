import { FileJson } from "lucide-react";
import { MCPServerList } from "../mcp/mcp-server-list";
import { MCPConfigGuide } from "../mcp/mcp-config-guide";
import { useMCPSettings } from "../../hooks/use-mcp-settings";

export function MCPTab() {
  const {
    configs,
    statuses,
    loading,
    connectServer,
    disconnectServer,
    openConfig,
    toggleTool,
  } = useMCPSettings();

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium" style={{ color: 'var(--vscode-foreground)' }}>
          MCP Servers
        </h2>
        <button
          type="button"
          onClick={openConfig}
          disabled={loading}
          className="flex items-center gap-2 min-h-[32px] rounded-xl px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)' }}
        >
          <FileJson className="h-4 w-4" />
          Edit Configuration
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <MCPConfigGuide />
        <MCPServerList
          configs={configs}
          statuses={statuses}
          onConnect={connectServer}
          onDisconnect={disconnectServer}
          onToggleTool={toggleTool}
        />
      </div>

    </div>
  );
}