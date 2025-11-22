import { X } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import type { ToolCall } from '../../types/tool';
import { getToolStatusDisplay } from '../../utils/tool-status-formatter';
import { getToolFileInfo } from '../../utils/tool-file-info';
import { renderToolResult } from './tool-result-renderer';
import { DiffViewer } from './diff-viewer';

interface ToolBlockProps {
  toolCall: ToolCall;
  isConnectedTop?: boolean;
  isConnectedBottom?: boolean;
  isStreaming?: boolean;
}

const ToolBlockComponent = ({
  toolCall,
  isConnectedTop = false,
  isConnectedBottom = false,
  isStreaming = false,
}: ToolBlockProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get status display
  const statusConfig = useMemo(
    () => getToolStatusDisplay(toolCall, isStreaming),
    [toolCall, isStreaming]
  );

  // Get file info and icon configuration
  const fileInfo = useMemo(
    () =>
      getToolFileInfo(
        toolCall.toolName,
        toolCall.parameters,
        toolCall.status,
        isStreaming
      ),
    [toolCall, isStreaming]
  );

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
            {(isStreaming || toolCall.status === 'pending' || toolCall.status === 'executing' || toolCall.status === 'fetching_diagnostics') ? (
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
            {typeof statusConfig === 'string' ? (
              <span
                className="text-xs font-medium"
                style={
                  isStreaming || toolCall.status === 'pending' || toolCall.status === 'executing'
                    ? {
                        background:
                          'linear-gradient(90deg, var(--vscode-descriptionForeground) 0%, var(--vscode-descriptionForeground) 40%, var(--vscode-foreground) 50%, var(--vscode-descriptionForeground) 60%, var(--vscode-descriptionForeground) 100%)',
                        backgroundSize: '300% 100%',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        animation: 'wave-shine 2s linear infinite',
                      }
                    : { color: 'var(--vscode-descriptionForeground)' }
                }
              >
                {statusConfig}
              </span>
            ) : (
              statusConfig
            )}
          </div>
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t" style={{ borderColor: 'var(--vscode-input-border)' }}>
          {/* Processing indicator or Real-time Streaming */}
          {(toolCall.status === 'executing' || toolCall.status === 'pending') &&
            !toolCall.result && (
              <>
                {toolCall.toolName === 'write_to_file' && toolCall.parameters.content ? (
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

export const ToolBlock = memo(ToolBlockComponent, (prevProps, nextProps) => {
  return (
    prevProps.toolCall.status === nextProps.toolCall.status &&
    prevProps.toolCall.toolName === nextProps.toolCall.toolName &&
    prevProps.isConnectedTop === nextProps.isConnectedTop &&
    prevProps.isConnectedBottom === nextProps.isConnectedBottom &&
    JSON.stringify(prevProps.toolCall.parameters) ===
      JSON.stringify(nextProps.toolCall.parameters) &&
    JSON.stringify(prevProps.toolCall.result) === JSON.stringify(nextProps.toolCall.result)
  );
});
