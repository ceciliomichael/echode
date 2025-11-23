import { useRef, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { MessageEditForm } from './message-edit-form';
import type { ImageAttachment } from '../../types/chat';
import type { ChatMode } from '../../types/chat-mode';

interface UserMessageProps {
  content: string;
  messageId: string;
  onEdit: (messageId: string, newContent: string, attachments?: ImageAttachment[]) => void;
  onUpdate: (messageId: string, newContent: string) => void;
  isEditing: boolean;
  onEditStart: (messageId: string) => void;
  onEditCancel: () => void;
  onRevert?: (messageId: string) => void;
  attachments?: ImageAttachment[];
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
}

export function UserMessage({ content, messageId, onEdit, onUpdate, isEditing, onEditStart, onEditCancel, onRevert, attachments, mode, onModeChange }: UserMessageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMessageClick = (e: React.MouseEvent) => {
    // Don't trigger edit if clicking the revert button
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    
    if (!isEditing) {
      onEditStart(messageId);
    }
  };

  const handleRevertClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRevert) {
      onRevert(messageId);
    }
  };

  const handleSubmit = (newContent: string, attachments?: ImageAttachment[]) => {
    onEdit(messageId, newContent, attachments);
  };

  const handleSave = (newContent: string) => {
    onUpdate(messageId, newContent);
  };

  if (isEditing) {
    return (
      <div data-message-id={messageId}>
        <MessageEditForm
          initialContent={content}
          onSubmit={handleSubmit}
          onCancel={onEditCancel}
          onSave={handleSave}
          attachments={attachments}
          mode={mode}
          onModeChange={onModeChange}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full px-2" data-message-id={messageId}>
      <div
        ref={containerRef}
        onClick={handleMessageClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="rounded-xl px-3 py-2 shadow-sm w-full border cursor-pointer hover:opacity-90 active:opacity-80 transition-opacity duration-150 relative"
        style={{
          backgroundColor: 'var(--vscode-chat-surface)',
          borderColor: 'var(--vscode-input-border)',
          color: 'var(--vscode-input-foreground)'
        }}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words pointer-events-none pr-8">
          {content}
        </p>
        
        {onRevert && isHovered && (
          <button
            onClick={handleRevertClick}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-xl hover:opacity-70 transition-opacity"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--vscode-input-foreground)'
            }}
            title="Revert to this message"
          >
            <Undo2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}