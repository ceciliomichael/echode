import { ChevronDown, ChevronRight, Archive } from 'lucide-react';

interface CompressedBlockHeaderProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function CompressedBlockHeader({
  isExpanded,
  onToggle,
}: CompressedBlockHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group w-full flex items-center justify-between px-3 py-2 transition-opacity hover:opacity-90 select-none"
      style={{
        backgroundColor: 'var(--vscode-editor-background)',
        outline: 'none',
      }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Icon container - shows archive icon by default, chevron on hover */}
        <div className="relative w-4 h-4 flex-shrink-0">
          {/* Archive Icon - visible by default, hidden on hover */}
          <Archive
            className="absolute inset-0 w-4 h-4 transition-opacity group-hover:opacity-0"
            style={{ color: '#a855f7' }}
          />
          {/* Chevron - hidden by default, visible on hover */}
          {isExpanded ? (
            <ChevronDown
              className="absolute inset-0 w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity"
              style={{ color: 'var(--vscode-foreground)' }}
            />
          ) : (
            <ChevronRight
              className="absolute inset-0 w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity"
              style={{ color: 'var(--vscode-foreground)' }}
            />
          )}
        </div>

        {/* Title */}
        <span
          className="text-sm font-medium truncate"
          style={{ color: 'var(--vscode-foreground)', opacity: 0.7 }}
        >
          Compressed History
        </span>

        {/* Status indicator */}
        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            Previous Session
          </span>
        </div>
      </div>
    </button>
  );
}