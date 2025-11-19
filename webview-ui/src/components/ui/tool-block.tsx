import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  X,
  Folder,
  Search,
  Trash2,
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
        icon: iconConfig.icon,
        iconColor: iconConfig.color,
      };
    }

    // List files -> Use Folder icon
    if (toolCall.toolName === 'list_files') {
      const displayPath = !path || path === '' ? 'root' : String(path);
      return {
        displayName: displayPath,
        fullPath: path || '',
        icon: Folder,
        iconColor: 'var(--vscode-charts-blue)',
      };
    }

    // Grep search -> Use Search icon
    if (toolCall.toolName === 'grep_search') {
      const query = toolCall.parameters.query as string;
      return {
        displayName: query ? `Search: ${query}` : 'Search',
        fullPath: path || '',
        icon: Search,
        iconColor: 'var(--vscode-editor-foreground)',
      };
    }

    // Edit file -> Use File type icon (same as write_file)
    if (toolCall.toolName === 'edit_file') {
      const fileName = path ? extractFileName(path) : 'file';
      const iconConfig = path ? getFileIconConfig(path) : getFileIconConfig('');
      return {
        displayName: fileName,
        fullPath: path || '',
        icon: iconConfig.icon,
        iconColor: iconConfig.color,
      };
    }

    // Delete file -> Use Trash icon
    if (toolCall.toolName === 'delete_file') {
      const fileName = path ? extractFileName(path) : 'file';
      return {
        displayName: fileName,
        fullPath: path || '',
        icon: Trash2,
        iconColor: 'var(--vscode-errorForeground)',
      };
    }

    // Generic file operations with path
    if (path) {
      const fileName = extractFileName(path);
      const iconConfig = getFileIconConfig(path);
      return {
        displayName: fileName,
        fullPath: path,
        icon: iconConfig.icon,
        iconColor: iconConfig.color,
      };
    }

    // Fallback
    const metadata = getToolMetadata(toolCall.toolName);
    return {
      displayName: metadata?.name || toolCall.toolName,
      fullPath: '',
      icon: metadata?.icon || getFileIconConfig('').icon,
      iconColor: 'var(--vscode-editor-foreground)',
    };
  }, [toolCall.parameters.path, toolCall.parameters.query, toolCall.toolName]);

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
          {/* Tool Icon */}
          <fileInfo.icon
            className="w-4 h-4 flex-shrink-0"
            style={{ color: fileInfo.iconColor }}
          />
          
          {/* Filename / Tool Name */}
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
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
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
                ) : toolCall.toolName === 'edit_file' && 
                    Array.isArray(toolCall.parameters.edits) && 
                    toolCall.parameters.edits.length > 0 ? (
                  <div className="space-y-2 px-3 py-2">
                    <div className="text-xs opacity-70 font-medium">Preparing edits...</div>
                    <div className="space-y-2">
                      {(toolCall.parameters.edits as Array<{oldString?: string; newString?: string; replaceAll?: boolean}>).map((edit, index) => (
                        <div 
                          key={index}
                          className="rounded border p-2 text-xs"
                          style={{
                            backgroundColor: 'var(--vscode-editor-background)',
                            borderColor: 'var(--vscode-input-border)',
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1 opacity-70">
                            <span className="font-semibold">Edit {index + 1}</span>
                            {edit.replaceAll && <span className="text-[10px] border rounded px-1">Replace All</span>}
                          </div>
                          
                          {edit.oldString && (
                            <div className="mb-1">
                              <div className="opacity-50 text-[10px] uppercase tracking-wider mb-0.5">Original</div>
                              <div className="font-mono p-1 rounded opacity-70 whitespace-pre-wrap break-all" style={{ backgroundColor: 'var(--vscode-input-background)' }}>
                                {edit.oldString.length > 200 ? edit.oldString.substring(0, 200) + '...' : edit.oldString}
                              </div>
                            </div>
                          )}
                          
                          {edit.newString && (
                            <div>
                              <div className="opacity-50 text-[10px] uppercase tracking-wider mb-0.5">New</div>
                              <div className="font-mono p-1 rounded whitespace-pre-wrap break-all" style={{ backgroundColor: 'var(--vscode-input-background)', color: 'var(--vscode-gitDecoration-addedResourceForeground)' }}>
                                {edit.newString.length > 200 ? edit.newString.substring(0, 200) + '...' : edit.newString}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
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
