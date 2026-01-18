import { Check, Copy, Maximize2, ChevronDown, ChevronRight } from 'lucide-react';
import type { MermaidBlockHeaderProps } from './types';

/**
 * Mermaid diagram icon SVG component
 */
const MermaidIcon = () => (
  <svg
    className="w-3.5 h-3.5"
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ color: '#FF3670' }}
  >
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

/**
 * Header component for the MermaidBlock
 * Contains toggle chevron, mermaid icon, label, and action buttons
 */
export const MermaidBlockHeader = ({
  isExpanded,
  isOpenInTab,
  isReady,
  copied,
  onToggle,
  onCopy,
  onOpenInTab,
}: MermaidBlockHeaderProps) => {
  // Can always expand/collapse unless open in tab
  const canToggle = !isOpenInTab;
  // Can only open in tab when diagram is ready and not already open
  const canOpenInTab = isReady && !isOpenInTab;

  return (
    <div
      className={`flex items-center justify-between pb-4 mb-4 select-none ${
        canToggle ? 'cursor-pointer' : 'cursor-default'
      }`}
      style={{
        borderBottom: '1px solid var(--vscode-input-border)',
        color: 'var(--vscode-descriptionForeground)',
      }}
      onClick={canToggle ? onToggle : undefined}
    >
      <div className="flex items-center gap-2">
        {isExpanded ? (
          <ChevronDown
            className="w-3.5 h-3.5"
            style={{ color: 'var(--vscode-foreground)', opacity: 0.6 }}
          />
        ) : (
          <ChevronRight
            className="w-3.5 h-3.5"
            style={{ color: 'var(--vscode-foreground)', opacity: 0.6 }}
          />
        )}
        <MermaidIcon />
        <span
          className="text-xs font-medium"
          style={{ color: 'var(--vscode-foreground)', opacity: 0.7 }}
        >
          Mermaid Diagram{isOpenInTab ? ' (Open in Tab)' : ''}
        </span>
      </div>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center py-1 px-1 rounded transition-colors"
          style={{ color: 'var(--vscode-foreground)', outline: 'none' }}
          title="Copy code"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 hover:scale-110 transition-transform" />
          ) : (
            <Copy className="w-3.5 h-3.5 hover:scale-110 transition-transform" />
          )}
        </button>
        <button
          type="button"
          onClick={canOpenInTab ? onOpenInTab : undefined}
          disabled={!canOpenInTab}
          className={`flex items-center py-1 px-1 rounded transition-colors ${
            !canOpenInTab ? 'opacity-30' : ''
          }`}
          style={{ color: 'var(--vscode-foreground)', outline: 'none' }}
          title={canOpenInTab ? 'Open in new tab' : 'Diagram not ready'}
        >
          <Maximize2 className={`w-3.5 h-3.5 ${canOpenInTab ? 'hover:scale-110' : ''} transition-transform`} />
        </button>
      </div>
    </div>
  );
};