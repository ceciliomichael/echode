import { Wrench } from 'lucide-react';
import { getAllToolMetadata } from '../../lib/tool-registry';
import type { Tool } from '../../types/api-settings';

interface ToolsTabProps {
  enabledTools: Tool[];
  onChange: (tools: Tool[]) => void;
}

export function ToolsTab({ enabledTools, onChange }: ToolsTabProps) {
  const allToolsMetadata = getAllToolMetadata();

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
          Enable or disable tools that the AI can use during conversations. Disabled tools will not be available to the AI assistant.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {allToolsMetadata.map((metadata) => {
          const enabled = isToolEnabled(metadata.id);
          
          return (
            <div
              key={metadata.id}
              className="rounded-lg border p-4 transition-all"
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
                      backgroundColor: 'var(--vscode-editor-background)',
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
