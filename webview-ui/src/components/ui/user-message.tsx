import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { Undo2 } from 'lucide-react';
import { MessageEditForm } from './message-edit-form/index';
import { Mention } from './mention';
import { CompressedBlock } from './compressed-block';

import type { ChatMode } from '../../types/chat-mode';
import type { Provider } from '../../types/api-settings';
import type { ContextUsageResult } from '../../hooks/use-context-usage';
import { stripAttachedFileBlocks, type DocumentAttachment } from '../../utils/document-utils';
import type { ImageAttachment } from '../../types/chat';

interface UserMessageProps {
  content: string;
  messageId: string;
  onEdit: (messageId: string, newContent: string, imageAttachments?: ImageAttachment[], forceEchoSearch?: boolean) => void;
  onUpdate: (messageId: string, newContent: string) => void;
  isEditing: boolean;
  onEditStart: (messageId: string) => void;
  onEditCancel: () => void;
  onRevert?: (messageId: string) => void;
  attachments?: DocumentAttachment[];
  imageAttachments?: ImageAttachment[];
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
  provider: Provider;
  model: string;
  onModelChange: (provider: Provider, model: string) => void;
  contextUsage?: ContextUsageResult;
  isFirstMessage?: boolean;
  isLastMessage?: boolean;
}

export function UserMessage({ content, messageId, onEdit, onUpdate, isEditing, onEditStart, onEditCancel, onRevert, attachments, imageAttachments, mode, onModeChange, provider, model, onModelChange, contextUsage, isFirstMessage = false, isLastMessage = false }: UserMessageProps) {

  // Check if this is a compressed history message - ONLY if it's the first message
  const isCompressedHistory = isFirstMessage && content.trimStart().startsWith('<compressed_history>');

  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const contentRef = useRef<HTMLParagraphElement>(null);
  const [isSingleLine, setIsSingleLine] = useState(true);
  const displayContent = stripAttachedFileBlocks(content);

  // Track if we were at the bottom BEFORE edit mode changes.
  // If we mount in edit mode and this is the last message (e.g. session reload), 
  // assume we should start at the bottom.
  const wasAtBottomRef = useRef(isEditing && isLastMessage);
  
  // Capture scroll position before edit mode changes (runs on every render)
  useEffect(() => {
    if (!isEditing) {
      const scrollContainer = containerRef.current?.closest('.overflow-y-auto') as HTMLElement | null;
      if (scrollContainer) {
        // Use a slightly larger threshold (10px) to match useAutoScroll logic
        wasAtBottomRef.current = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 10;
      }
    }
  });

  // Ensure message is visible when editing toggles (enter or exit)
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const scrollContainer = element.closest('.overflow-y-auto') as HTMLElement | null;
    if (!scrollContainer) return;

    // If user was at the bottom before opening edit, we need to maintain that position.
    // The key insight: we DON'T scroll here. Instead, we let the content render naturally
    // and use CSS scroll-anchor or the backup mechanism below.
    // The "bounce" happens because we scroll, then content resizes, then we scroll again.
    // Solution: Don't fight it. Just ensure final position is correct after everything settles.
    if (isEditing && wasAtBottomRef.current) {
      // Skip the immediate scroll - let React finish rendering first
      // Use a MutationObserver to detect when the edit form has fully rendered
      const observer = new MutationObserver(() => {
        // Once mutations settle, snap to bottom
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      });
      
      observer.observe(element, { 
        childList: true, 
        subtree: true, 
        attributes: true,
        characterData: true 
      });
      
      // Cleanup observer after a short period (the form should be done rendering)
      const cleanup = setTimeout(() => {
        observer.disconnect();
        // Final snap to ensure we're at bottom
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }, 150);
      
      return () => {
        observer.disconnect();
        clearTimeout(cleanup);
      };
    }

    const elementRect = element.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const padding = 20; // Visual breathing room for non-bottom cases

    // Smart scrolling logic to maintain user context
    const isTallerThanContainer = elementRect.height > containerRect.height;

    if (isTallerThanContainer) {
      if (elementRect.top >= containerRect.top) {
         const scrollTopDelta = elementRect.top - containerRect.top - padding;
         scrollContainer.scrollBy({ top: scrollTopDelta, behavior: 'auto' });
      } else {
         const scrollBottomDelta = elementRect.bottom - containerRect.bottom;
         if (scrollBottomDelta > 0) {
            scrollContainer.scrollBy({ top: scrollBottomDelta, behavior: 'auto' });
         }
      }
    } else {
      if (elementRect.top < containerRect.top) {
        const scrollTopDelta = elementRect.top - containerRect.top - padding;
        scrollContainer.scrollBy({ top: scrollTopDelta, behavior: 'auto' });
      } else if (elementRect.bottom > containerRect.bottom) {
        const scrollBottomDelta = elementRect.bottom - containerRect.bottom + padding;
        scrollContainer.scrollBy({ top: scrollBottomDelta, behavior: 'auto' });
      }
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

  const handleSubmit = (newContent: string, editedImageAttachments?: ImageAttachment[], forceEchoSearch?: boolean) => {
    // Pass image attachments from the edit form to the edit handler
    onEdit(messageId, newContent, editedImageAttachments, forceEchoSearch);
  };

  const handleSave = (newContent: string, _imageAttachments?: ImageAttachment[], _attachments?: DocumentAttachment[]) => {
    onUpdate(messageId, newContent);
  };

  if (isEditing) {
    return (
      <div 
        ref={containerRef} 
        data-message-id={messageId} 
        className="relative z-[100]"
        onClick={(e) => e.stopPropagation()}
      >
        <MessageEditForm
          initialContent={content}
          onSubmit={handleSubmit}
          onCancel={onEditCancel}
          onSave={handleSave}
          attachments={attachments}
          imageAttachments={imageAttachments}
          mode={mode}
          onModeChange={onModeChange}
          provider={provider}
          model={model}
          onModelChange={onModelChange}
          contextUsage={contextUsage}
          isSaveMode={false}
        />
      </div>
    );
  }

  // Render CompressedBlock for compressed history messages
  if (isCompressedHistory) {
    return (
      <div className="flex w-full" data-message-id={messageId}>
        <CompressedBlock content={content} />
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
            <Mention text={displayContent} />
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