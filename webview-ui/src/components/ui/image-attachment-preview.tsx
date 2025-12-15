import { useState } from 'react';
import { X } from 'lucide-react';
import type { ImageAttachment } from '../../types/chat';

interface ImageAttachmentPreviewProps {
  attachments: ImageAttachment[];
  onRemove: (index: number) => void;
  disabled?: boolean;
}

export function ImageAttachmentPreview({ attachments, onRemove, disabled = false }: ImageAttachmentPreviewProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (attachments.length === 0) return null;

  const getImageSrc = (attachment: ImageAttachment) => {
    return `data:${attachment.mimeType};base64,${attachment.data}`;
  };

  return (
    <>
      {attachments.map((attachment, index) => (
        <div key={index} className="relative">
          <button
            type="button"
            onClick={() => !disabled && onRemove(index)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 text-xs border border-dashed rounded-md px-2 py-1 transition-all hover:opacity-70 disabled:opacity-50 disabled:cursor-not-allowed group"
            style={{
              borderColor: 'var(--vscode-input-border)',
              backgroundColor: 'transparent',
              color: 'var(--vscode-descriptionForeground)',
              maxWidth: '200px'
            }}
            aria-label={`Remove ${attachment.name || 'image'}`}
          >
            <div
              className="w-4 h-4 rounded border overflow-hidden flex-shrink-0 relative"
              style={{ borderColor: 'var(--vscode-input-border)' }}
            >
              <img
                src={getImageSrc(attachment)}
                alt={attachment.name || 'Image'}
                className="w-full h-full object-cover group-hover:opacity-0 transition-opacity"
              />
              <X
                className="w-3 h-3 absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--vscode-descriptionForeground)' }}
              />
            </div>
            <span className="truncate min-w-0" style={{ color: 'var(--vscode-foreground)' }}>
              {attachment.name || 'Image'}
            </span>
          </button>

          {/* Hover preview */}
          {hoveredIndex === index && (
            <div
              className="absolute bottom-full left-0 mb-2 z-50 rounded-lg border shadow-lg overflow-hidden"
              style={{
                backgroundColor: 'var(--vscode-editor-background)',
                borderColor: 'var(--vscode-input-border)'
              }}
            >
              <img
                src={getImageSrc(attachment)}
                alt={attachment.name || 'Image preview'}
                className="max-w-[200px] max-h-[150px] object-contain"
              />
            </div>
          )}
        </div>
      ))}
    </>
  );
}
