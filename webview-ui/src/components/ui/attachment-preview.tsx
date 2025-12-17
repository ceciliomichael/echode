import { useState } from 'react';
import { X, FileText } from 'lucide-react';
import type { DocumentAttachment } from '../../utils/document-utils';

interface AttachmentPreviewProps {
  attachments: DocumentAttachment[];
  onRemove: (index: number) => void;
  disabled?: boolean;
  tooltipDirection?: 'up' | 'down';
}

export function AttachmentPreview({
  attachments,
  onRemove,
  disabled = false,
  tooltipDirection = 'up'
}: AttachmentPreviewProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (attachments.length === 0) return null;

  return (
    <>
      {attachments.map((attachment, index) => (
        <div key={index} className="relative inline-block">
          <button
            type="button"
            onClick={() => !disabled && onRemove(index)}
            disabled={disabled}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            className="inline-flex items-center gap-1.5 text-xs border border-dashed rounded-xl px-2 py-1 transition-all hover:opacity-70 disabled:opacity-50 disabled:cursor-not-allowed group"
            style={{
              borderColor: 'var(--vscode-input-border)',
              backgroundColor: 'transparent',
              color: 'var(--vscode-descriptionForeground)',
              maxWidth: '200px'
            }}
            aria-label={`Remove ${attachment.name}`}
          >
            <div className="w-4 h-4 rounded border overflow-hidden flex-shrink-0 relative flex items-center justify-center" style={{ borderColor: 'var(--vscode-input-border)' }}>
              <FileText className="w-3 h-3 group-hover:opacity-0 transition-opacity" style={{ color: 'var(--vscode-descriptionForeground)' }} />
              <X className="w-3 h-3 absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--vscode-descriptionForeground)' }} />
            </div>
            <span className="truncate min-w-0" style={{ color: 'var(--vscode-foreground)' }}>
              {attachment.name}
            </span>
          </button>

          {/* Tooltip */}
          {hoveredIndex === index && (
            <div
              className="absolute left-1/2 -translate-x-1/2 px-2 py-1 text-xs rounded whitespace-nowrap pointer-events-none z-50"
              style={{
                ...(tooltipDirection === 'up'
                  ? { bottom: 'calc(100% + 6px)' }
                  : { top: 'calc(100% + 6px)' }
                ),
                backgroundColor: 'var(--vscode-editorHoverWidget-background)',
                border: '1px solid var(--vscode-editorHoverWidget-border)',
                color: 'var(--vscode-editorHoverWidget-foreground)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
              }}
            >
              {attachment.name}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
