import { X, Search, FolderOpen } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import type { ToolCall, EchoSearchProgress } from '../../types/tool';
import { getToolStatusDisplay } from '../../utils/tool-status-formatter';
import { getToolFileInfo } from '../../utils/tool-file-info';
import { renderToolResult } from './tool-result-renderer';
import { DiffViewer } from './diff-viewer';
import { getFileIconConfig } from '../../utils/file-icon-mapper';

/**
 * Parse tool call string to extract tool name and parameter
 * e.g., "grep_search(authentication)" -> { tool: 'grep_search', param: 'authentication' }
 */
function parseToolCall(toolCall: string): { tool: string; param: string } {
  const match = toolCall.match(/^(\w+)\((.+)\)$/);
  if (match) {
    return { tool: match[1], param: match[2] };
  }
  return { tool: toolCall, param: '' };
}

/**
 * Get icon config for a tool - uses file icon for read_file, search icon for others
 */
function getToolIconConfig(toolCall: string) {
  const { tool, param } = parseToolCall(toolCall);
  
  if (tool === 'read_file_snippet' || tool === 'read_file') {
    // Use file icon based on the file path
    return getFileIconConfig(param);
  }
  
  // Default icons for search tools
  if (tool === 'grep_search') {
    return { icon: Search, color: 'var(--vscode-symbolIcon-functionForeground)' };
  }
  if (tool === 'glob_search') {
    return { icon: Search, color: 'var(--vscode-symbolIcon-fileForeground)' };
  }
  if (tool === 'list_dir') {
    return { icon: FolderOpen, color: 'var(--vscode-symbolIcon-folderForeground)' };
  }
  
  return { icon: Search, color: 'var(--vscode-descriptionForeground)' };
}

/**
 * Splash texts for echo_search progress
 */
const ECHO_SEARCH_SPLASH_TEXTS = [
  'Searching codebase...',
  'Finding relevant files...',
  'Analyzing patterns...',
  'Exploring directories...',
  'Scanning for matches...',
  'Discovering context...',
];

/**
 * Progress indicator for echo_search tool - shows tools like final result snippets
 */
function EchoSearchProgressIndicator({ progress }: { progress: EchoSearchProgress }) {
  // Pick a splash text based on iteration
  const splashText = ECHO_SEARCH_SPLASH_TEXTS[progress.iteration % ECHO_SEARCH_SPLASH_TEXTS.length];

  return (
    <div className="rounded-md overflow-hidden border border-[var(--vscode-input-border)] bg-[var(--vscode-editor-background)]">
      {/* Minimal header with splash text and wave animation */}
      <div
        className="px-3 py-1.5 border-b border-[var(--vscode-input-border)] flex items-center justify-between text-xs"
      >
        <style>
          {`
            @keyframes wave-shine {
              0% { background-position: 200% 0; }
              100% { background-position: -100% 0; }
            }
          `}
        </style>
        <span
          className="font-medium"
          style={{
            background: 'linear-gradient(90deg, var(--vscode-descriptionForeground) 0%, var(--vscode-descriptionForeground) 40%, var(--vscode-foreground) 50%, var(--vscode-descriptionForeground) 60%, var(--vscode-descriptionForeground) 100%)',
            backgroundSize: '300% 100%',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'wave-shine 2s linear infinite',
          }}
        >
          {splashText}
        </span>
        <span
          className="font-medium"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          {progress.iteration}/{progress.maxIterations}
        </span>
      </div>

      {/* Tool List - styled like snippet items */}
      <div>
        {progress.tools.length > 0 ? (
          progress.tools.map((toolCall, idx) => {
            const { tool, param } = parseToolCall(toolCall);
            const iconConfig = getToolIconConfig(toolCall);
            const Icon = iconConfig.icon;
            
            return (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-2 border-b border-[var(--vscode-input-border)] last:border-b-0"
              >
                <Icon
                  className="w-3.5 h-3.5 flex-shrink-0"
                  style={{ color: iconConfig.color }}
                />
                <span
                  className="text-xs font-medium truncate flex-1"
                  style={{ color: 'var(--vscode-foreground)' }}
                >
                  {param || tool}
                </span>
                <span
                  className="text-xs opacity-50"
                  style={{ color: 'var(--vscode-descriptionForeground)' }}
                >
                  {tool}
                </span>
              </div>
            );
          })
        ) : (
          <div
            className="px-3 py-2 text-xs italic"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            Analyzing codebase...
          </div>
        )}
      </div>
    </div>
  );
}

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
  // Planning tools should auto-expand to show interactive elements
  const isPlanningTool = toolCall.toolName === 'plan_navigator' || toolCall.toolName === 'plan_handoff';
  const [isExpanded, setIsExpanded] = useState(isPlanningTool);

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
                  <div className="px-3 py-2">
                    <DiffViewer
                      oldContent={undefined}
                      newContent={toolCall.parameters.content as string}
                      fileName={fileInfo.displayName}
                      isStreaming={true}
                      viewOnly={true}
                    />
                  </div>
                ) : toolCall.toolName === 'echo_search' && toolCall.progress ? (
                  <div className="px-3 py-2">
                    <EchoSearchProgressIndicator progress={toolCall.progress} />
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
    JSON.stringify(prevProps.toolCall.result) === JSON.stringify(nextProps.toolCall.result) &&
    prevProps.toolCall.progress?.iteration === nextProps.toolCall.progress?.iteration &&
    prevProps.toolCall.progress?.phase === nextProps.toolCall.progress?.phase &&
    prevProps.toolCall.progress?.tools?.length === nextProps.toolCall.progress?.tools?.length
  );
});
