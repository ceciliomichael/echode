import { useState, useRef, useEffect } from 'react';
import { X, Play } from 'lucide-react';
import type { QueuedMessage, ImageAttachment } from '../../../types/chat';
import type { ChatMode } from '../../../types/chat-mode';
import type { Provider } from '../../../types/api-settings';
import { Mention } from '../mention';
import { MessageEditForm } from '../message-edit-form';

interface QueueItemProps {
  message: QueuedMessage;
  index: number;
  onUpdate: (id: string, content: string, imageAttachments?: ImageAttachment[]) => void;
  onRemove: (id: string) => void;
  onForceSend: (id: string) => void;
  provider: Provider;
  model: string;
  mode?: ChatMode;
  onModelChange: (provider: Provider, model: string) => void;
}

export function QueueItem({
  message,
  index,
  onUpdate,
  onRemove,
  onForceSend,
  provider,
  model,
  mode,
  onModelChange,
}: QueueItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const contentRef = useRef<HTMLParagraphElement>(null);
  const [isSingleLine, setIsSingleLine] = useState(true);

  // Clean up content by removing file attachment blocks for display
  const getDisplayContent = (content: string): string => {
    return content.replace(/<attached_file[^>]*>[\s\S]*?<\/attached_file>/g, '').trim();
  };

  const displayContent = getDisplayContent(message.content);

  // Detect single line for button positioning
  useEffect(() => {
    if (!contentRef.current) return;

    const element = contentRef.current;
    const computedStyle = window.getComputedStyle(element);
    const lineHeight = parseFloat(computedStyle.lineHeight || '0');

    if (!lineHeight) {
      setTimeout(() => setIsSingleLine(true), 0);
      return;
    }

    const lineCount = element.scrollHeight / lineHeight;
    setTimeout(() => setIsSingleLine(lineCount <= 1.1), 0);
  }, [displayContent]);

  const handleSave = (content: string, imageAttachments?: ImageAttachment[]) => {
    onUpdate(message.id, content, imageAttachments);
    setIsEditing(false);
  };

  const handleSubmit = () => {
    // When submitting from edit form in queue, just save (don't send)
    // The onSave callback handles the save action
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger edit if clicking buttons
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    setIsEditing(true);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(message.id);
  };

  const handleForceSend = (e: React.MouseEvent) => {
    e.stopPropagation();
    onForceSend(message.id);
  };

  if (isEditing) {
    return (
      <div className="relative" data-edit-outside-ignore="true">
        <MessageEditForm
          initialContent={message.content}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onSave={handleSave}
          imageAttachments={message.imageAttachments}
          provider={provider}
          model={model}
          onModelChange={onModelChange}
          mode={mode}
        />
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="rounded-xl px-3 py-2 shadow-sm w-full border cursor-pointer hover:opacity-90 active:opacity-80 transition-opacity duration-150 relative flex items-start gap-3"
      style={{
        backgroundColor: 'var(--vscode-chat-surface)',
        borderColor: 'var(--vscode-input-border)',
        color: 'var(--vscode-input-foreground)',
      }}
    >
      {/* Position indicator */}
      <div
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-md text-[10px] font-bold mt-0.5"
        style={{
          backgroundColor: index === 0 ? 'var(--vscode-charts-blue)' : 'var(--vscode-badge-background)',
          color: index === 0 ? 'var(--vscode-editor-background)' : 'var(--vscode-badge-foreground)',
        }}
      >
        {index + 1}
      </div>

      {/* Content */}
      <div className="overflow-hidden flex-1 min-w-0">
        <p
          ref={contentRef}
          className="text-sm leading-relaxed whitespace-pre-wrap break-words pointer-events-none"
          style={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 5,
            overflow: 'hidden',
          }}
        >
          <Mention text={displayContent} />
        </p>

        {/* Image attachments indicator removed as requested */}
      </div>

      {/* Action buttons - shown on hover */}
      {isHovered && (
        <div
          className={`absolute right-2 flex items-center gap-1 ${isSingleLine ? 'top-1/2 -translate-y-1/2' : 'bottom-1.5'}`}
        >
          <button
            onClick={handleForceSend}
            className="p-1 rounded-md hover:opacity-70 transition-opacity"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--vscode-charts-green)',
            }}
            title="Send immediately"
          >
            <Play className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRemove}
            className="p-1 rounded-md hover:opacity-70 transition-opacity"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--vscode-errorForeground)',
            }}
            title="Remove from queue"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}