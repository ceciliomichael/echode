import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
} from 'lucide-react';
import { memo, type ReactNode, useMemo, useState } from 'react';
import { getToolMetadata, getToolRenderer } from '../../lib/tool-registry';
import type { ToolCall } from '../../types/tool';
import { getFileIconConfig, extractFileName } from '../../utils/file-icon-mapper';
import { DiffViewer } from './diff-viewer';

interface ToolBlockProps {
  toolCall: ToolCall;
  isConnectedTop?: boolean;
  isConnectedBottom?: boolean;
}

const ToolBlockComponent = ({ toolCall, isConnectedTop = false, isConnectedBottom = false }: ToolBlockProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = useMemo(() => {
    switch (toolCall.status) {
      case 'pending':
      case 'executing':
        return {
          icon: <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--vscode-charts-blue)' }} />,
          label: 'Executing',
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
  }, [toolCall.status]);

  // Get file path and icon configuration
  const fileInfo = useMemo(() => {
    const path = toolCall.parameters.path as string | undefined;
    
    // For write_file and read_file, ALWAYS prioritize showing filename
    if ((toolCall.toolName === 'write_file' || toolCall.toolName === 'read_file') && path) {
      const fileName = extractFileName(path);
      const iconConfig = getFileIconConfig(path);
      return {
        displayName: fileName,
        fullPath: path,
        iconConfig: iconConfig,
      };
    }

    if (toolCall.toolName === 'list_files') {
      const displayPath = !path || path === '' ? 'root' : String(path);
      return {
        displayName: displayPath,
        fullPath: path || '',
        iconConfig: getFileIconConfig(''),
      };
    }

    // Generic file operations with path
    if (path) {
      const fileName = extractFileName(path);
      const iconConfig = getFileIconConfig(path);
      return {
        displayName: fileName,
        fullPath: path,
        iconConfig: iconConfig,
      };
    }

    // Fallback for tools without path (shouldn't happen for file tools)
    return {
      displayName: getToolMetadata(toolCall.toolName)?.name || toolCall.toolName,
      fullPath: '',
      iconConfig: getFileIconConfig(''),
    };
  }, [toolCall.parameters.path, toolCall.toolName]);

  return (
    <div 
      className={`shadow-sm overflow-hidden w-full ${isConnectedTop ? 'mt-0' : 'mt-2'}`}
      style={{
        borderColor: 'var(--vscode-input-border)',
        backgroundColor: 'var(--vscode-input-background)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderTopWidth: isConnectedTop ? 0 : '1px',
        borderTopLeftRadius: isConnectedTop ? 0 : '0.75rem',
        borderTopRightRadius: isConnectedTop ? 0 : '0.75rem',
        borderBottomLeftRadius: isConnectedBottom ? 0 : '0.75rem',
        borderBottomRightRadius: isConnectedBottom ? 0 : '0.75rem',
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
          {/* Language-specific file icon */}
          <fileInfo.iconConfig.icon
            className="w-4 h-4 flex-shrink-0"
            style={{ color: fileInfo.iconConfig.color }}
          />
          
          {/* Filename */}
          <span 
            className="text-sm font-medium truncate"
            style={{ color: 'var(--vscode-input-foreground)' }}
          >
            {fileInfo.displayName}
          </span>
          
          {/* Status indicator */}
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            {statusConfig.icon}
            <span 
              className="text-xs font-medium"
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
          className="border-t"
          style={{ borderColor: 'var(--vscode-input-border)' }}
        >
          {/* Processing indicator or Real-time Streaming */}
          {(toolCall.status === 'executing' || toolCall.status === 'pending') &&
            !toolCall.result && (
              <>
                {toolCall.toolName === 'write_file' && 
                 toolCall.parameters.content ? (
                  <DiffViewer
                    oldContent={undefined}
                    newContent={toolCall.parameters.content as string}
                    fileName={fileInfo.displayName}
                    isStreaming={true}
                    viewOnly={true}
                  />
                ) : (
                  <div 
                    className="px-3 py-2"
                    style={{
                      backgroundColor: 'var(--vscode-textCodeBlock-background)',
                    }}
                  >
                    <div 
                      className="text-xs italic animate-pulse"
                      style={{ color: 'var(--vscode-descriptionForeground)' }}
                    >
                      {toolCall.toolName === 'write_file' && toolCall.parameters.path 
                        ? 'Preparing file diff...' 
                        : 'Executing tool...'}
                    </div>
                  </div>
                )}
              </>
            )}

          {/* Result */}
          {toolCall.result && (
            <div className="overflow-x-auto">
              {toolCall.result.success ? (
                <div style={{ color: 'var(--vscode-input-foreground)' }}>
                  {renderToolResult(toolCall.toolName, toolCall.result.data, fileInfo.displayName)}
                </div>
              ) : (
                <div 
                  className="px-3 py-2"
                  style={{
                    backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
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

function renderToolResult(toolName: string, data: unknown, fileName: string): ReactNode {
  // Special handling for read_file - show view-only viewer
  if (toolName === 'read_file' && typeof data === 'object' && data !== null) {
    const result = data as { content?: string };
    if (result.content !== undefined) {
      return (
        <DiffViewer
          oldContent={undefined}
          newContent={result.content}
          fileName={fileName}
          viewOnly={true}
        />
      );
    }
  }

  // Special handling for write_file tool - show diff viewer
  if (toolName === 'write_file' && typeof data === 'object' && data !== null) {
    const result = data as {
      path?: string;
      action?: string;
      oldContent?: string | null;
      newContent?: string;
    };

    if (result.newContent !== undefined) {
      return (
        <DiffViewer
          oldContent={result.oldContent ?? null}
          newContent={result.newContent}
          fileName={fileName}
        />
      );
    }
  }

  // Use registered renderer for other tools
  const renderer = getToolRenderer(toolName);
  if (renderer) {
    return <div className="px-3 py-2">{renderer(data) as ReactNode}</div>;
  }

  // Default fallback
  return (
    <div className="px-3 py-2">
      <pre 
        className="text-xs font-mono whitespace-pre overflow-x-auto p-2 rounded"
        style={{
          color: 'var(--vscode-input-foreground)',
          backgroundColor: 'var(--vscode-textCodeBlock-background)',
        }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export const ToolBlock = memo(ToolBlockComponent, (prevProps, nextProps) => {
  return (
    prevProps.toolCall.status === nextProps.toolCall.status &&
    prevProps.toolCall.toolName === nextProps.toolCall.toolName &&
    prevProps.isConnectedTop === nextProps.isConnectedTop &&
    prevProps.isConnectedBottom === nextProps.isConnectedBottom &&
    JSON.stringify(prevProps.toolCall.parameters) ===
      JSON.stringify(nextProps.toolCall.parameters) &&
    JSON.stringify(prevProps.toolCall.result) ===
      JSON.stringify(nextProps.toolCall.result)
  );
});
