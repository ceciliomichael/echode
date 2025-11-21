import {
  Minus,
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
  isStreaming?: boolean;
}

/**
 * Strip line numbers from content formatted as "lineNum: content"
 * Used to show clean code in UI while AI sees line numbers
 */
function stripLineNumbers(content: string): string {
  return content
    .split('\n')
    .map(line => {
      // Match "number: " at start of line
      const match = line.match(/^\d+: (.*)$/);
      return match ? match[1] : line;
    })
    .join('\n');
}

/**
 * Calculate diff statistics from old and new content
 */
function calculateDiffStats(oldContent: string | null | undefined, newContent: string): { additions: number; deletions: number } {
  if (oldContent === null || oldContent === undefined) {
    const newLines = newContent.split('\n');
    return { additions: newLines.length, deletions: 0 };
  }

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  let additions = 0;
  let deletions = 0;

  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    const oldLine = oldLines[oldIndex];
    const newLine = newLines[newIndex];

    if (oldIndex >= oldLines.length) {
      additions++;
      newIndex++;
    } else if (newIndex >= newLines.length) {
      deletions++;
      oldIndex++;
    } else if (oldLine === newLine) {
      oldIndex++;
      newIndex++;
    } else {
      const foundInOld = oldLines.slice(oldIndex + 1).indexOf(newLine);
      const foundInNew = newLines.slice(newIndex + 1).indexOf(oldLine);

      if (foundInOld !== -1 && (foundInNew === -1 || foundInOld <= foundInNew)) {
        deletions++;
        oldIndex++;
      } else if (foundInNew !== -1) {
        additions++;
        newIndex++;
      } else {
        deletions++;
        additions++;
        oldIndex++;
        newIndex++;
      }
    }
  }

  return { additions, deletions };
}

const ToolBlockComponent = ({ toolCall, isConnectedTop = false, isConnectedBottom = false, isStreaming = false }: ToolBlockProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = useMemo(() => {
    // Handle error and aborted states first
    if (toolCall.status === 'error') {
      return 'Error';
    }
    if (toolCall.status === 'aborted') {
      return 'Aborted';
    }

    // Show streaming or executing state
    if (isStreaming || toolCall.status === 'pending' || toolCall.status === 'executing') {
      return 'Executing';
    }

    // Tool-specific completed states
    const toolName = toolCall.toolName;
    const metadata = getToolMetadata(toolName);

    // read_file: show "Read"
    if (toolName === 'read_file') {
      return 'Read';
    }

    // edit_file, multi_edit, write_to_file: show diff stats with color
    if (toolName === 'edit_file' || toolName === 'multi_edit' || toolName === 'write_to_file') {
      if (toolCall.result?.success && toolCall.result.data) {
        const data = toolCall.result.data as {
          oldContent?: string | null;
          newContent?: string;
          originalContent?: string;
        };
        
        const oldContent = data.oldContent ?? data.originalContent ?? null;
        const newContent = data.newContent;
        
        if (newContent !== undefined) {
          const { additions, deletions } = calculateDiffStats(oldContent, newContent);
          return (
            <span className="flex gap-1.5">
              {additions > 0 && (
                <span style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground)' }}>
                  +{additions}
                </span>
              )}
              {deletions > 0 && (
                <span style={{ color: 'var(--vscode-gitDecoration-deletedResourceForeground)' }}>
                  -{deletions}
                </span>
              )}
              {additions === 0 && deletions === 0 && 'No changes'}
            </span>
          );
        }
      }
      // Fallback for edit tools without result yet
      return 'Edit';
    }

    // todo_write, todo_read: show todo count
    if (toolName === 'todo_write' || toolName === 'todo_read') {
      if (toolCall.result?.success && toolCall.result.data) {
        const data = toolCall.result.data as { tasks?: Array<{ status: string }> };
        const tasks = data.tasks || [];
        const completed = tasks.filter(t => t.status === 'completed').length;
        return `${completed}/${tasks.length}`;
      }
      return 'Todo';
    }

    // Other tools: show tool name from metadata
    const displayName = metadata?.name || toolName;
    // Shorten common tool names
    const shortName = displayName
      .replace('List Files', 'List')
      .replace('Grep Search', 'Grep')
      .replace('Delete File', 'Delete');
    
    return shortName;
  }, [isStreaming, toolCall.status, toolCall.toolName, toolCall.result]);

  // Get file path and icon configuration (with executing state)
  const fileInfo = useMemo(() => {
    const path = toolCall.parameters.path as string | undefined;
    const isExecuting = isStreaming || toolCall.status === 'pending' || toolCall.status === 'executing';
    
    // For write_to_file and read_file, ALWAYS prioritize showing filename
    if ((toolCall.toolName === 'write_to_file' || toolCall.toolName === 'read_file') && path) {
      const fileName = extractFileName(path);
      const iconConfig = getFileIconConfig(path);
      
      return {
        displayName: fileName,
        fullPath: path,
        icon: isExecuting ? Minus : iconConfig.icon,
        iconColor: iconConfig.color,
        isSpinning: isExecuting,
      };
    }

    // List files -> Use Folder icon
    if (toolCall.toolName === 'list_files') {
      const displayPath = !path || path === '' ? 'root' : String(path);
      return {
        displayName: displayPath,
        fullPath: path || '',
        icon: isExecuting ? Minus : Folder,
        iconColor: 'var(--vscode-charts-blue)',
        isSpinning: isExecuting,
      };
    }

    // Grep search -> Use Search icon
    if (toolCall.toolName === 'grep_search') {
      const query = toolCall.parameters.query as string;
      const truncatedQuery = query && query.length > 60 ? query.substring(0, 60) + '...' : query;
      return {
        displayName: truncatedQuery ? `Search: ${truncatedQuery}` : 'Search',
        fullPath: path || '',
        icon: isExecuting ? Minus : Search,
        iconColor: 'var(--vscode-editor-foreground)',
        isSpinning: isExecuting,
      };
    }

    // Delete file -> Use Trash icon
    if (toolCall.toolName === 'delete_file') {
      const fileName = path ? extractFileName(path) : 'file';
      return {
        displayName: fileName,
        fullPath: path || '',
        icon: isExecuting ? Minus : Trash2,
        iconColor: 'var(--vscode-errorForeground)',
        isSpinning: isExecuting,
      };
    }

    // Generic file operations with path
    if (path) {
      const fileName = extractFileName(path);
      const iconConfig = getFileIconConfig(path);
      return {
        displayName: fileName,
        fullPath: path,
        icon: isExecuting ? Minus : iconConfig.icon,
        iconColor: iconConfig.color,
        isSpinning: isExecuting,
      };
    }

    // Fallback
    const metadata = getToolMetadata(toolCall.toolName);
    return {
      displayName: metadata?.name || toolCall.toolName,
      fullPath: '',
        icon: isExecuting ? Minus : (metadata?.icon || getFileIconConfig('').icon),
      iconColor: 'var(--vscode-editor-foreground)',
      isSpinning: isExecuting,
    };
  }, [toolCall.parameters.path, toolCall.parameters.query, toolCall.toolName, toolCall.status, isStreaming]);

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
          {/* Tool Icon (with spinner when executing) */}
          <fileInfo.icon
            className={`w-4 h-4 flex-shrink-0 ${fileInfo.isSpinning ? 'animate-spin' : ''}`}
            style={{ color: fileInfo.iconColor }}
          />
          
          {/* Filename / Tool Name */}
          <span 
            className="text-sm font-medium truncate"
            style={{ color: 'var(--vscode-input-foreground)' }}
          >
            {fileInfo.displayName}
          </span>
          
          {/* Status indicator (no icon, just label) */}
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            {(isStreaming || toolCall.status === 'pending' || toolCall.status === 'executing') ? (
              <style>
                {`
                  @keyframes wave-shine {
                    0% {
                      background-position: 200% 0;
                    }
                    100% {
                      background-position: -100% 0;
                    }
                  }
                `}
              </style>
            ) : null}
            <span 
              className="text-xs font-medium"
              style={
                (isStreaming || toolCall.status === 'pending' || toolCall.status === 'executing')
                  ? {
                      background: 'linear-gradient(90deg, var(--vscode-descriptionForeground) 0%, var(--vscode-descriptionForeground) 40%, var(--vscode-foreground) 50%, var(--vscode-descriptionForeground) 60%, var(--vscode-descriptionForeground) 100%)',
                      backgroundSize: '300% 100%',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      animation: 'wave-shine 2s linear infinite'
                    }
                  : { color: 'var(--vscode-descriptionForeground)' }
              }
            >
              {statusConfig}
            </span>
          </div>
        </div>
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
                {toolCall.toolName === 'write_to_file' && 
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
                      {toolCall.toolName === 'write_to_file' && toolCall.parameters.path 
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
    const result = data as { content?: string; startLine?: number; endLine?: number };
    if (result.content !== undefined) {
      // Strip line numbers from content for clean UI display (AI sees them, user doesn't)
      const cleanContent = stripLineNumbers(result.content);
      
      return (
        <DiffViewer
          oldContent={undefined}
          newContent={cleanContent}
          fileName={fileName}
          viewOnly={true}
          startLineNumber={result.startLine || 1}
          endLineNumber={result.endLine}
        />
      );
    }
  }

  // Special handling for write_to_file tool - show diff viewer
  if (toolName === 'write_to_file' && typeof data === 'object' && data !== null) {
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

  // Special handling for edit_file tool - show diff viewer
  if (toolName === 'edit_file' && typeof data === 'object' && data !== null) {
    const result = data as {
      path?: string;
      originalContent?: string;
      newContent?: string;
      truncated?: boolean;
    };

    if (result.originalContent !== undefined && result.newContent !== undefined) {
      return (
        <DiffViewer
          oldContent={result.originalContent}
          newContent={result.newContent}
          fileName={fileName}
        />
      );
    }
  }

  // Special handling for multi_edit tool - show diff viewer
  if (toolName === 'multi_edit' && typeof data === 'object' && data !== null) {
    const result = data as {
      path?: string;
      originalContent?: string;
      newContent?: string;
      truncated?: boolean;
    };

    if (result.originalContent !== undefined && result.newContent !== undefined) {
      return (
        <DiffViewer
          oldContent={result.originalContent}
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
