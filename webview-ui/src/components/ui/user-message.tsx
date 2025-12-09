import { useRef, useState, useEffect } from 'react';
import { Undo2 } from 'lucide-react';
import { MessageEditForm } from './message-edit-form';
import { MentionText } from './mention-text';

import type { ChatMode } from '../../types/chat-mode';
import type { Provider } from '../../types/api-settings';
import type { ContextUsageResult } from '../../hooks/use-context-usage';
import { stripAttachedFileBlocks, type DocumentAttachment } from '../../utils/document-utils';

interface UserMessageProps {
  content: string;
  messageId: string;
  onEdit: (messageId: string, newContent: string, attachments?: undefined, forceEchoSearch?: boolean) => void;
  onUpdate: (messageId: string, newContent: string) => void;
  isEditing: boolean;
  onEditStart: (messageId: string) => void;
  onEditCancel: () => void;
  onRevert?: (messageId: string) => void;
  attachments?: DocumentAttachment[];
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
  provider: Provider;
  model: string;
  onModelChange: (provider: Provider, model: string) => void;
  contextUsage?: ContextUsageResult;
}

export function UserMessage({ content, messageId, onEdit, onUpdate, isEditing, onEditStart, onEditCancel, onRevert, attachments, mode, onModeChange, provider, model, onModelChange, contextUsage }: UserMessageProps) {

  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const contentRef = useRef<HTMLParagraphElement>(null);
  const [isSingleLine, setIsSingleLine] = useState(true);
  const displayContent = stripAttachedFileBlocks(content);

  // Scroll to make edit form visible when entering edit mode
  useEffect(() => {
    if (isEditing && containerRef.current) {
      // Small delay to ensure DOM has updated
      setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }, [isEditing]);

  useEffect(() => {
    if (!contentRef.current) return;

    const element = contentRef.current;
    const computedStyle = window.getComputedStyle(element);
    const lineHeight = parseFloat(computedStyle.lineHeight || '0');

    if (!lineHeight) {
      // Defer state update to avoid synchronous setState in effect body
      setTimeout(() => {
        setIsSingleLine(true);
      }, 0);
      return;
    }

    const lineCount = element.scrollHeight / lineHeight;

    // Defer state update to avoid synchronous setState in effect body
    setTimeout(() => {
      setIsSingleLine(lineCount <= 1.1);
    }, 0);
  }, [displayContent]);

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

  const handleSubmit = (newContent: string, _attachments?: undefined, forceEchoSearch?: boolean) => {
    // Attachments are now embedded in content as <attached_file> blocks
    onEdit(messageId, newContent, undefined, forceEchoSearch);
  };

  const handleSave = (newContent: string) => {
    onUpdate(messageId, newContent);
  };

  if (isEditing) {
    return (
      <div ref={containerRef} data-message-id={messageId} className="relative">
        <MessageEditForm
          initialContent={content}
          onSubmit={handleSubmit}
          onCancel={onEditCancel}
          onSave={handleSave}
          attachments={attachments}
          mode={mode}
          onModeChange={onModeChange}
          provider={provider}
          model={model}
          onModelChange={onModelChange}
          contextUsage={contextUsage}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full" data-message-id={messageId}>
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
        <div className="overflow-hidden">
          <p
            ref={contentRef}
            className="text-sm leading-relaxed whitespace-pre-wrap break-words pointer-events-none"
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 5,
              overflow: 'hidden'
            }}
          >
            <MentionText text={displayContent} />
          </p>
        </div>

        {onRevert && isHovered && (
          <button
            onClick={handleRevertClick}
            className={`absolute right-2 p-1 rounded-xl hover:opacity-70 transition-opacity ${isSingleLine ? 'top-1/2 -translate-y-1/2' : 'bottom-1.5'}`}
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