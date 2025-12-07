import { X, Image as ImageIcon } from 'lucide-react';
import type { ImageAttachment } from '../../types/chat';

interface ImageAttachmentPreviewProps {
  attachments: ImageAttachment[];
  onRemove: (index: number) => void;
  disabled?: boolean;
}

export function ImageAttachmentPreview({ attachments, onRemove, disabled = false }: ImageAttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <>
      {attachments.map((attachment, index) => (
        <button
          key={index}
          type="button"
          onClick={() => !disabled && onRemove(index)}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 text-xs border border-dashed rounded-md px-2 py-1 transition-all hover:opacity-70 disabled:opacity-50 disabled:cursor-not-allowed group"
          style={{
            borderColor: 'var(--vscode-input-border)',
            backgroundColor: 'transparent',
            color: 'var(--vscode-descriptionForeground)',
            width: '114px'
          }}
          aria-label={`Remove ${attachment.name || 'image'}`}
        >
          <div
            className="w-4 h-4 rounded border overflow-hidden flex-shrink-0 relative flex items-center justify-center"
            style={{ borderColor: 'var(--vscode-input-border)' }}
          >
            <ImageIcon
              className="w-3 h-3 group-hover:opacity-0 transition-opacity"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
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
      ))}
    </>
  );
}
