import { Plus } from "lucide-react";
import { useState } from "react";
import { MCPServerList } from "../mcp/mcp-server-list";
import { MCPServerForm } from "../mcp/mcp-server-form";
import { useMCPSettings } from "../../hooks/use-mcp-settings";
import type { MCPServerConfig } from "../mcp/types";

export function MCPTab() {
  const {
    configs,
    statuses,
    loading,
    saveConfig,
    deleteConfig,
    connectServer,
    disconnectServer,
    refreshServer,
  } = useMCPSettings();

  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<MCPServerConfig | null>(
    null,
  );

  const handleAddServers = (newConfigs: MCPServerConfig[]) => {
    // Save each config
    newConfigs.forEach(config => saveConfig(config));
    setShowForm(false);
    setEditingConfig(null);
  };

  const handleEdit = (config: MCPServerConfig) => {
    setEditingConfig(config);
    setShowForm(true);
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="mb-4">
        <h2 className="text-lg font-medium mb-1" style={{ color: 'var(--vscode-foreground)' }}>MCP Servers</h2>
        <p className="text-sm" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          Manage Model Context Protocol servers to extend capabilities with external tools.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {showForm ? (
          <MCPServerForm
            initialConfigs={editingConfig ? [editingConfig] : []}
            onSubmit={handleAddServers}
            onCancel={() => {
              setShowForm(false);
              setEditingConfig(null);
            }}
            isEditing={editingConfig !== null}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowForm(true)}
                disabled={loading}
                className="flex items-center gap-2 min-h-[32px] rounded-sm px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)' }}
              >
                <Plus className="h-4 w-4" />
                Add Server
              </button>
            </div>

            <MCPServerList
              configs={configs}
              statuses={statuses}
              onConnect={connectServer}
              onDisconnect={disconnectServer}
              onDelete={deleteConfig}
              onRefresh={refreshServer}
              onEdit={handleEdit}
            />
          </div>
        )}
      </div>

      {loading && (
        <div className="border-t px-6 py-3" style={{ borderColor: 'var(--vscode-widget-border)' }}>
          <p className="text-sm" style={{ color: 'var(--vscode-descriptionForeground)' }}>Processing...</p>
        </div>
      )}
    </div>
  );
}