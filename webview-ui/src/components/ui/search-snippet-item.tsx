import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { CSSProperties, ComponentType } from 'react';

interface SearchSnippetItemLine {
  lineNumber: number;
  text: string;
}

interface SearchSnippetItemProps {
  path: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  iconColor: string;
  startLine: number;
  endLine: number;
  chipLabel?: string;
  chipStyle?: CSSProperties;
  reason?: string;
  lines: SearchSnippetItemLine[];
  hasCode?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export function SearchSnippetItem({
  path,
  icon: Icon,
  iconColor,
  startLine,
  endLine,
  chipLabel,
  chipStyle,
  reason,
  lines,
  hasCode = true,
  isExpanded,
  onToggle,
}: SearchSnippetItemProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = isExpanded ?? internalExpanded;
  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };
  const hasLines = hasCode && lines.length > 0;
  const maxLineNumber = hasLines
    ? Math.max(...lines.map((line) => line.lineNumber))
    : endLine;
  const lineNumWidth = maxLineNumber.toString().length;

  return (
    <div className="border-b border-[var(--vscode-input-border)] last:border-b-0">
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 opacity-50 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 opacity-50 flex-shrink-0" />
        )}
        <Icon
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: iconColor }}
        />
        <span
          className="text-xs font-medium truncate flex-1"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          {path}
        </span>
        <span
          className="text-xs opacity-50 font-mono"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          {startLine}-{endLine}
        </span>
        {chipLabel && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={chipStyle}
          >
            {chipLabel}
          </span>
        )}
      </button>
      {expanded && (
        <div>
          {reason && (
            <div
              className="text-xs mb-1 mt-1 px-3 leading-relaxed"
              style={{ color: 'var(--vscode-foreground)', opacity: 0.85 }}
            >
              {reason}
            </div>
          )}
          {hasLines && (
            <div className="max-h-[300px] overflow-auto border-t border-[var(--vscode-input-border)] bg-[var(--vscode-editor-background)]">
              <pre
                className="text-xs font-mono m-0 p-2 whitespace-pre"
                style={{
                  color: 'var(--vscode-editor-foreground)',
                  backgroundColor: 'var(--vscode-editor-background)',
                }}
              >
                <code className="block" style={{ backgroundColor: 'transparent' }}>
                  {lines.map((line) => {
                    const safeText = line.text ?? '';
                    return (
                    <div
                      key={`${line.lineNumber}-${safeText.slice(0, 16)}`}
                      className="min-h-[1.15rem] leading-[1.15rem]"
                    >
                      <span
                        className="select-none mr-4 opacity-70 text-right inline-block"
                        style={{
                          color: 'var(--vscode-editorLineNumber-foreground)',
                          minWidth: `${lineNumWidth}ch`,
                        }}
                      >
                        {line.lineNumber}
                      </span>
                      {safeText || '\u00A0'}
                    </div>
                  );
                  })}
                </code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
