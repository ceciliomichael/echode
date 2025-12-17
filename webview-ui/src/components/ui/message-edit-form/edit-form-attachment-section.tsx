import { AttachmentPreview } from '../attachment-preview';
import { ImageAttachmentPreview } from '../image-attachment-preview';
import type { DocumentAttachment } from '../../../utils/document-utils';
import type { ImageAttachment } from '../../../types/chat';

interface EditFormAttachmentSectionProps {
  attachments: DocumentAttachment[];
  imageAttachments: ImageAttachment[];
  onRemoveAttachment: (index: number) => void;
  onRemoveImageAttachment: (index: number) => void;
  onAttachmentClick: () => void;
  canAddMore: boolean;
}

export function EditFormAttachmentSection({
  attachments,
  imageAttachments,
  onRemoveAttachment,
  onRemoveImageAttachment,
  onAttachmentClick,
  canAddMore
}: EditFormAttachmentSectionProps) {
  const hasAttachments = attachments.length > 0 || imageAttachments.length > 0;

  return (
    <div className="w-full px-1.5 pt-1.5">
      <div className="flex flex-wrap items-center gap-1 min-h-[28px]">
        {!hasAttachments ? (
          <button
            type="button"
            onClick={onAttachmentClick}
            className="text-xs border border-dashed rounded-xl px-2 py-1 transition-all hover:opacity-70"
            style={{
              color: 'var(--vscode-descriptionForeground)',
              borderColor: 'var(--vscode-input-border)',
              backgroundColor: 'transparent'
            }}
          >
            + No Attachments
          </button>
        ) : (
          <>
            <AttachmentPreview
              attachments={attachments}
              onRemove={onRemoveAttachment}
              disabled={false}
              tooltipDirection="down"
            />
            <ImageAttachmentPreview
              attachments={imageAttachments}
              onRemove={onRemoveImageAttachment}
              disabled={false}
              tooltipDirection="down"
            />
            {canAddMore && (
              <button
                type="button"
                onClick={onAttachmentClick}
                className="text-xs border border-dashed rounded-xl px-2 py-1 transition-all hover:opacity-70"
                style={{
                  color: 'var(--vscode-descriptionForeground)',
                  borderColor: 'var(--vscode-input-border)',
                  backgroundColor: 'transparent'
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