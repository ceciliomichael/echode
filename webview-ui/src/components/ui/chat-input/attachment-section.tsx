import { AttachmentPreview } from '../attachment-preview';
import { ImageAttachmentPreview } from '../image-attachment-preview';
import type { DocumentAttachment } from '../../../utils/document-utils';
import type { ImageAttachment } from '../../../types/chat';

interface AttachmentSectionProps {
  attachments: DocumentAttachment[];
  imageAttachments: ImageAttachment[];
  onRemoveAttachment: (index: number) => void;
  onRemoveImageAttachment: (index: number) => void;
  onAttachmentClick: () => void;
  canAddMore: boolean;
  disabled?: boolean;
}

export function AttachmentSection({
  attachments,
  imageAttachments,
  onRemoveAttachment,
  onRemoveImageAttachment,
  onAttachmentClick,
  canAddMore,
  disabled = false,
}: AttachmentSectionProps) {
  const hasAttachments = attachments.length > 0 || imageAttachments.length > 0;

  return (
    <div className="w-full px-1.5 pt-1.5 overflow-hidden">
      <div className="flex items-center gap-1 min-h-[28px] overflow-hidden flex-nowrap">
        {!hasAttachments ? (
          <button
            type="button"
            onClick={onAttachmentClick}
            disabled={disabled}
            className="text-xs border border-dashed rounded-xl px-2 py-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden text-ellipsis whitespace-nowrap min-w-0 max-w-full"
            style={{
              color: 'var(--vscode-descriptionForeground)',
              borderColor: 'var(--vscode-input-border)',
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                e.currentTarget.style.boxShadow = '0 0 0 1px rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--vscode-input-border)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            + No Attachments
          </button>
        ) : (
          <>
            <AttachmentPreview
              attachments={attachments}
              onRemove={onRemoveAttachment}
              disabled={disabled}
              tooltipDirection="up"
            />
            <ImageAttachmentPreview
              attachments={imageAttachments}
              onRemove={onRemoveImageAttachment}
              disabled={disabled}
              tooltipDirection="up"
            />
            {canAddMore && (
              <button
                type="button"
                onClick={onAttachmentClick}
                disabled={disabled}
                className="text-xs border border-dashed rounded-xl px-2 py-1 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden text-ellipsis whitespace-nowrap min-w-0 shrink-0"
                style={{
                  color: 'var(--vscode-descriptionForeground)',
                  borderColor: 'var(--vscode-input-border)',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (!disabled) {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                    e.currentTarget.style.boxShadow = '0 0 0 1px rgba(255, 255, 255, 0.3)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--vscode-input-border)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                + Add
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}