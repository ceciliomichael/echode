import { useRef } from 'react';
import { MessageEditForm } from './message-edit-form';

interface UserMessageProps {
  content: string;
  messageId: string;
  onEdit: (messageId: string, newContent: string) => void;
  onUpdate: (messageId: string, newContent: string) => void;
  isEditing: boolean;
  onEditStart: (messageId: string) => void;
  onEditCancel: () => void;
}

export function UserMessage({ content, messageId, onEdit, onUpdate, isEditing, onEditStart, onEditCancel }: UserMessageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMessageClick = () => {
    if (!isEditing) {
      onEditStart(messageId);
    }
  };

  const handleSubmit = (newContent: string) => {
    onEdit(messageId, newContent);
  };

  const handleSave = (newContent: string) => {
    onUpdate(messageId, newContent);
  };

  if (isEditing) {
    return (
      <MessageEditForm
        initialContent={content}
        onSubmit={handleSubmit}
        onCancel={onEditCancel}
        onSave={handleSave}
      />
    );
  }

  return (
    <div className="flex justify-start px-2">
      <div
        ref={containerRef}
        onClick={handleMessageClick}
        className="rounded-xl px-3 py-2 shadow-sm max-w-full border cursor-pointer hover:opacity-90 active:opacity-80 transition-opacity duration-150"
        style={{
          backgroundColor: 'var(--vscode-chat-surface)',
          borderColor: 'var(--vscode-input-border)',
          color: 'var(--vscode-input-foreground)'
        }}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words pointer-events-none">
          {content}
        </p>
      </div>
    </div>
  );
}