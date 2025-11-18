import {
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  X,
} from 'lucide-react';
import { memo, type ReactNode, useMemo, useState } from 'react';
import { getToolMetadata, getToolRenderer } from '../../lib/tool-registry';
import type { ToolCall } from '../../types/tool';

interface ToolBlockProps {
  toolCall: ToolCall;
}

const ToolBlockComponent = ({ toolCall }: ToolBlockProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = useMemo(() => {
    const toolName = toolCall.toolName.toLowerCase();

    const getCustomLabel = (status: 'pending' | 'executing'): string => {
      if (toolName.includes('write')) {
        return status === 'pending' ? 'Creating file...' : 'Writing content...';
      }
      if (toolName.includes('read')) {
        return status === 'pending' ? 'Reading file...' : 'Loading content...';
      }
      if (toolName.includes('list')) {
        return status === 'pending' ? 'Listing files...' : 'Scanning directory...';
      }
      return status === 'pending' ? 'Pending' : 'Processing...';
    };

    switch (toolCall.status) {
      case 'pending':
        return {
          icon: <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--vscode-descriptionForeground)' }} />,
          label: getCustomLabel('pending'),
        };
      case 'executing':
        return {
          icon: <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--vscode-statusBarItem-prominentForeground)' }} />,
          label: getCustomLabel('executing'),
        };
      case 'completed':
        return {
          icon: <Check className="w-3.5 h-3.5" style={{ color: 'var(--vscode-testing-iconPassed)' }} />,
          label: 'Completed',
        };
      case 'error':
        return {
          icon: <X className="w-3.5 h-3.5" style={{ color: 'var(--vscode-errorForeground)' }} />,
          label: 'Error',
        };
      case 'aborted':
        return {
          icon: <X className="w-3.5 h-3.5" style={{ color: 'var(--vscode-descriptionForeground)' }} />,
          label: 'Aborted',
        };
      default:
        return {
          icon: null,
          label: 'Unknown',
        };
    }
  }, [toolCall.status, toolCall.toolName]);

  const toolMetadata = useMemo(() => {
    return getToolMetadata(toolCall.toolName);
  }, [toolCall.toolName]);

  const toolIcon = useMemo(() => {
    if (!toolMetadata?.icon) {
      return <FileText className="w-3.5 h-3.5" style={{ color: 'var(--vscode-foreground)' }} />;
    }
    const IconComponent = toolMetadata.icon;
    if (typeof IconComponent !== 'function') {
      return null;
    }
    return <IconComponent className="w-3.5 h-3.5" style={{ color: 'var(--vscode-foreground)' }} />;
  }, [toolMetadata]);

  const toolDisplayName = useMemo(() => {
    return toolMetadata?.name || toolCall.toolName;
  }, [toolMetadata, toolCall.toolName]);

  const filePathDisplay = useMemo(() => {
    if (toolCall.toolName === 'list_files') {
      const path = toolCall.parameters.path;
      if (!path || path === '') {
        return 'root';
      }
      return String(path);
    }

    if (toolCall.parameters.path) {
      const path = String(toolCall.parameters.path);
      const filename = path.split('/').filter(Boolean).pop() || path;
      return filename;
    }
    return null;
  }, [toolCall.parameters.path, toolCall.toolName]);

  return (
    <div 
      className="mt-2 rounded-xl border shadow-sm overflow-hidden w-full"
      style={{
        borderColor: 'var(--vscode-input-border)',
        backgroundColor: 'var(--vscode-input-background)',
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 transition-opacity hover:opacity-90"
        style={{
          backgroundColor: 'var(--vscode-input-background)',
          outline: 'none',
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {toolIcon}
          <span 
            className="text-sm font-medium"
            style={{ color: 'var(--vscode-input-foreground)' }}
          >
            {toolDisplayName}
          </span>
          {filePathDisplay && (
            <span 
              className="text-xs font-medium px-2 py-0.5 rounded truncate"
              style={{
                color: 'var(--vscode-statusBarItem-prominentForeground)',
                backgroundColor: 'var(--vscode-statusBarItem-prominentBackground)',
              }}
            >
              {filePathDisplay}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            {statusConfig.icon}
            <span 
              className="text-xs"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            >
              {statusConfig.label}
            </span>
          </div>
        </div>
        <span style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </span>
      </button>

      {/* Content */}
      {isExpanded && (
        <div 
          className="px-3 pb-2 border-t overflow-x-auto"
          style={{ borderColor: 'var(--vscode-input-border)' }}
        >
          {/* Show file path for file operations */}
          {toolCall.parameters.path != null && (
            <div 
              className="mt-2 border rounded-lg p-2 overflow-x-auto"
              style={{
                backgroundColor: 'var(--vscode-textCodeBlock-background)',
                borderColor: 'var(--vscode-input-border)',
              }}
            >
              <div 
                className="text-xs font-semibold mb-1"
                style={{ color: 'var(--vscode-descriptionForeground)' }}
              >
                File Path
              </div>
              <div 
                className="text-sm font-medium break-all"
                style={{ color: 'var(--vscode-input-foreground)' }}
              >
                {String(toolCall.parameters.path)}
              </div>
            </div>
          )}

          {/* Processing indicator */}
          {(toolCall.status === 'executing' || toolCall.status === 'pending') &&
            !toolCall.result && (
              <div 
                className="mt-2 border rounded-lg p-2"
                style={{
                  backgroundColor: 'var(--vscode-textCodeBlock-background)',
                  borderColor: 'var(--vscode-input-border)',
                }}
              >
                <div 
                  className="text-xs italic animate-pulse"
                  style={{ color: 'var(--vscode-descriptionForeground)' }}
                >
                  Executing tool...
                </div>
              </div>
            )}

          {/* Result */}
          {toolCall.result && (
            <div className="mt-2 overflow-x-auto">
              {toolCall.result.success ? (
                <div className="text-sm" style={{ color: 'var(--vscode-input-foreground)' }}>
                  {renderToolResult(toolCall.toolName, toolCall.result.data)}
                </div>
              ) : (
                <div 
                  className="border rounded-lg p-2"
                  style={{
                    backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
                    borderColor: 'var(--vscode-inputValidation-errorBorder)',
                  }}
                >
                  <div className="flex items-start gap-2">
                    <X 
                      className="w-3.5 h-3.5 mt-0.5 shrink-0"
                      style={{ color: 'var(--vscode-errorForeground)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div 
                        className="text-sm font-semibold mb-1"
                        style={{ color: 'var(--vscode-errorForeground)' }}
                      >
                        Error
                      </div>
                      <div 
                        className="text-sm break-words whitespace-pre-wrap"
                        style={{ color: 'var(--vscode-errorForeground)' }}
                      >
                        {toolCall.result.error?.split('\n\n')[0]}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function renderToolResult(toolName: string, data: unknown): ReactNode {
  const renderer = getToolRenderer(toolName);

  if (renderer) {
    return renderer(data) as ReactNode;
  }

  // Default fallback
  return (
    <pre 
      className="text-xs font-mono whitespace-pre overflow-x-auto p-2 rounded"
      style={{
        color: 'var(--vscode-input-foreground)',
        backgroundColor: 'var(--vscode-textCodeBlock-background)',
      }}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export const ToolBlock = memo(ToolBlockComponent, (prevProps, nextProps) => {
  return (
    prevProps.toolCall.status === nextProps.toolCall.status &&
    prevProps.toolCall.toolName === nextProps.toolCall.toolName &&
    JSON.stringify(prevProps.toolCall.parameters) ===
      JSON.stringify(nextProps.toolCall.parameters) &&
    JSON.stringify(prevProps.toolCall.result) ===
      JSON.stringify(nextProps.toolCall.result)
  );
});
