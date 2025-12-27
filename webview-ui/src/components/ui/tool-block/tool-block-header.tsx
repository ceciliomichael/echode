import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ToolFileInfo } from '../../../utils/tool-file-info';
import type { ToolStatus } from '../../../types/tool';

interface ToolBlockHeaderProps {
  isExpanded: boolean;
  onToggle: () => void;
  fileInfo: ToolFileInfo;
  statusConfig: string | ReactNode;
  status: ToolStatus;
  isStreaming?: boolean;
  canToggle: boolean;
}

export function ToolBlockHeader({
  isExpanded,
  onToggle,
  fileInfo,
  statusConfig,
  status,
  isStreaming,
  canToggle,
}: ToolBlockHeaderProps) {
  // Always show chevron on hover since users can always toggle
  const showChevron = canToggle;

  return (
    <button
      type="button"
      onClick={canToggle ? onToggle : undefined}
      disabled={!canToggle}
      className={`group w-full flex items-center justify-between px-3 py-2 transition-opacity select-none ${
        canToggle ? 'hover:opacity-90' : 'opacity-70 cursor-default'
      }`}
      style={{
        backgroundColor: 'var(--vscode-editor-background)',
        outline: 'none',
      }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Icon container - shows tool icon by default, chevron on hover when expandable */}
        <div className="relative w-4 h-4 flex-shrink-0">
          {/* Tool Icon - visible by default, hidden on hover only when chevron is available */}
          <fileInfo.icon
            className={`absolute inset-0 w-4 h-4 transition-opacity ${showChevron ? 'group-hover:opacity-0' : ''} ${fileInfo.isSpinning ? 'animate-spin' : ''}`}
            style={{ color: fileInfo.iconColor }}
          />
          {/* Chevron - hidden by default, visible on hover only when tool is done and has content */}
          {showChevron && (isExpanded ? (
            <ChevronDown
              className="absolute inset-0 w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity"
              style={{ color: 'var(--vscode-foreground)' }}
            />
          ) : (
            <ChevronRight
              className="absolute inset-0 w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity"
              style={{ color: 'var(--vscode-foreground)' }}
            />
          ))}
        </div>

        {/* Filename / Tool Name */}
        <span
          className="text-sm font-medium truncate"
          style={{ color: 'var(--vscode-foreground)', opacity: 0.7 }}
          title={fileInfo.displayName}
        >
          {fileInfo.displayName}
        </span>

        {/* Status indicator (no icon, just label) */}
        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          {(isStreaming || status === 'pending' || status === 'executing' || status === 'fetching_diagnostics') ? (
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
                isStreaming || status === 'pending' || status === 'executing'
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
  );
}
