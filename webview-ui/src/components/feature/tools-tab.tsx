import { Wrench, RotateCcw } from 'lucide-react';
import { getAllToolMetadata } from '../../lib/tool-registry';
import { getAllTools } from '../../lib/tool-config';
import type { Tool } from '../../types/api-settings';

interface ToolsTabProps {
  enabledTools: Tool[];
  onChange: (tools: Tool[]) => void;
}

export function ToolsTab({ enabledTools, onChange }: ToolsTabProps) {
  // Filter out:
  // - echo_search: always available in all modes
  // - plan: exclusive to Plan mode only
  // - MCP tools: managed in MCP tab
  const allToolsMetadata = getAllToolMetadata().filter(
    (metadata) => 
      metadata.id !== 'echo_search' && 
      metadata.id !== 'plan' &&
      metadata.id !== 'publish_findings' &&
      !metadata.id.startsWith('mcp_')
  );

  const handleToggle = (toolId: string) => {
    const toolExists = enabledTools.find(t => t.id === toolId);
    
    if (toolExists) {
      // Toggle existing tool
      const updated = enabledTools.map(t => 
        t.id === toolId ? { ...t, enabled: !t.enabled } : t
      );
      onChange(updated);
    } else {
      // Add new tool as enabled
      const metadata = allToolsMetadata.find(m => m.id === toolId);
      if (metadata) {
        onChange([
          ...enabledTools,
          {
            id: metadata.id,
            name: metadata.name,
            description: metadata.description,
            aiDescription: metadata.aiDescription,
            enabled: true,
          }
        ]);
      }
    }
  };

  const isToolEnabled = (toolId: string): boolean => {
    const tool = enabledTools.find(t => t.id === toolId);
    return tool ? tool.enabled : false;
  };

  const handleClearAllSettings = () => {
    // Reset all tools to default state (all enabled)
    const defaultTools = getAllTools(true);
    onChange(defaultTools);
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6 sm:mb-8">
        <div 
          className="flex items-center gap-2 mb-2"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          <Wrench size={18} strokeWidth={1.5} />
          <h2 className="text-base sm:text-lg font-semibold">Tool Configuration</h2>
        </div>
        <p 
          className="text-xs sm:text-sm"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          Manage tools available in Agent mode. Other modes (Plan, Ask, General) use fixed tool sets that cannot be customized.
        </p>
      </div>

      <div className="mb-4 sm:mb-6">
        <button
          onClick={handleClearAllSettings}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm transition-all hover:opacity-80"
          style={{
            backgroundColor: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            border: '1px solid var(--vscode-button-border)',
          }}
          aria-label="Clear all tool settings"
        >
          <RotateCcw size={14} strokeWidth={1.5} />
          Clear All Settings
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {allToolsMetadata.map((metadata) => {
          const enabled = isToolEnabled(metadata.id);
          
          return (
            <div
              key={metadata.id}
              className="rounded-xl border p-4 transition-all"
              style={{
                backgroundColor: 'var(--vscode-input-background)',
                borderColor: enabled 
                  ? 'var(--vscode-focusBorder)' 
                  : 'var(--vscode-input-border)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <metadata.icon 
                      size={16} 
                      strokeWidth={1.5}
                      style={{ 
                        color: enabled 
                          ? 'var(--vscode-textLink-foreground)' 
                          : 'var(--vscode-descriptionForeground)',
                        flexShrink: 0
                      }}
                    />
                    <h3 
                      className="text-sm font-semibold truncate"
                      style={{ 
                        color: enabled 
                          ? 'var(--vscode-foreground)' 
                          : 'var(--vscode-descriptionForeground)' 
                      }}
                    >
                      {metadata.name}
                    </h3>
                  </div>
                  <p 
                    className="text-xs leading-relaxed"
                    style={{ color: 'var(--vscode-descriptionForeground)' }}
                  >
                    {metadata.description}
                  </p>
                </div>
                
                <button
                  onClick={() => handleToggle(metadata.id)}
                  className="shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  style={{
                    backgroundColor: enabled 
                      ? 'var(--vscode-button-background)' 
                      : 'var(--vscode-input-border)',
                  }}
                  aria-label={`Toggle ${metadata.name}`}
                >
                  <span
                    className="inline-block h-4 w-4 transform rounded-full transition-transform"
                    style={{
                      backgroundColor: '#ffffff',
                      transform: enabled ? 'translateX(1.5rem)' : 'translateX(0.25rem)',
                    }}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
