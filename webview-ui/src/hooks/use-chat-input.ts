import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type FormEvent, type ChangeEvent } from 'react';
import { usePasteHandler } from './use-paste-handler';
import { useContextMenu, type UseContextMenuReturn } from './use-context-menu';
import { useAttachmentHandler, type UseAttachmentHandlerReturn } from './use-attachment-handler';
import { mentionRegex } from '../utils/context-mentions';
import { buildAllAttachedFileBlocks, type DocumentAttachment } from '../utils/document-utils';
import type { ImageAttachment, Message } from '../types/chat';
import type { ChatMode } from '../types/chat-mode';
import type { InputWithHighlightsRef } from '../components/ui/input-with-highlights';

interface UseChatInputOptions {
  onSendMessage: (message: string, attachments?: ImageAttachment[], forceEchoSearch?: boolean, overrideMessages?: Message[]) => void;
  disabled?: boolean;
  mode?: ChatMode;
  restoredInput?: string | null;
  restoredAttachments?: DocumentAttachment[] | null;
  restoredImageAttachments?: ImageAttachment[] | null;
}

export interface UseChatInputReturn {
  // Input state
  input: string;
  setInput: (value: string) => void;
  textareaRef: React.RefObject<InputWithHighlightsRef | null>;
  
  // Attachment handler
  attachmentHandler: UseAttachmentHandlerReturn;
  
  // Context menu
  contextMenu: UseContextMenuReturn;
  
  // Event handlers
  handleChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: FormEvent, forceEchoSearch?: boolean) => void;
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  handleValueChange: (newValue: string, newCursorPos: number) => void;
  handleBlur: () => void;
  handleFocus: () => void;
}

export function useChatInput({
  onSendMessage,
  disabled = false,
  mode,
  restoredInput,
  restoredAttachments,
  restoredImageAttachments
}: UseChatInputOptions): UseChatInputReturn {
  const [input, setInput] = useState(restoredInput ?? '');
  const textareaRef = useRef<InputWithHighlightsRef | null>(null);

  // Initialize attachment handler (allow during streaming for queued messages)
  const attachmentHandler = useAttachmentHandler({
    initialAttachments: restoredAttachments ?? [],
    initialImageAttachments: restoredImageAttachments ?? [],
    disabled
  });

  // Initialize context menu
  const contextMenu = useContextMenu({
    input,
    setInput,
    textareaRef
  });

  // Initialize paste handler (allow during streaming for queued messages)
  const { handlePaste } = usePasteHandler({
    attachmentsRef: attachmentHandler.attachmentsRef,
    setAttachments: attachmentHandler.setAttachments,
    imageAttachmentsRef: attachmentHandler.imageAttachmentsRef,
    setImageAttachments: attachmentHandler.setImageAttachments,
    disabled
  });

  // Auto-resize textarea effect
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      if (input) {
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }
  }, [input]);

  const handleSubmit = useCallback((e: FormEvent, forceEchoSearch: boolean = false) => {
    e.preventDefault();
    const content = input;
    
    if (content.trim() && !disabled) {
      // Expand mentions to full format: @[label](path)
      let expandedContent = content;
      expandedContent = expandedContent.replace(mentionRegex, (match, label, path) => {
        if (path) {return match;} // Already has path

        const storedPath = contextMenu.mentionPathMap.current.get(label);
        if (storedPath) {
          return `@[${label}](${storedPath})`;
        }
        return match;
      });

      // Use refs to get current attachment state (avoids stale closure)
      const currentAttachments = attachmentHandler.attachmentsRef.current;
      const currentImageAttachments = attachmentHandler.imageAttachmentsRef.current;

      // Build <attached_file> blocks and append to message content
      const attachmentBlocks = buildAllAttachedFileBlocks(currentAttachments);
      const contentWithAttachments = expandedContent + attachmentBlocks;

      onSendMessage(
        contentWithAttachments,
        currentImageAttachments,
        forceEchoSearch
      );

      setInput('');
      attachmentHandler.clearAttachments();
      contextMenu.mentionPathMap.current.clear();
    }
  }, [input, disabled, contextMenu.mentionPathMap, attachmentHandler.attachmentsRef, attachmentHandler.imageAttachmentsRef, attachmentHandler.clearAttachments, onSendMessage]);

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart;
    setInput(newValue);
    contextMenu.updateCursorPosition(newValue, newCursorPos);
  }, [contextMenu]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // First, let context menu handle the key if applicable
    if (contextMenu.handleContextMenuKeyDown(e)) {
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      // Ctrl+Enter: force echo_search for Agent, Plan, and Ask modes
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleSubmit(e, mode === 'agent' || mode === 'plan' || mode === 'ask');
        return;
      }

      // Regular Enter: normal send
      e.preventDefault();
      handleSubmit(e);
    }
  }, [contextMenu, handleSubmit, mode]);

  const handleValueChange = useCallback((newValue: string, newCursorPos: number) => {
    setInput(newValue);
    contextMenu.updateCursorPosition(newValue, newCursorPos);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  }, [contextMenu]);

  const handleBlur = useCallback(() => {
    contextMenu.setShowContextMenu(false);
  }, [contextMenu]);

  const handleFocus = useCallback(() => {
    contextMenu.checkContextMenuOnFocus();
  }, [contextMenu]);

  return {
    // Input state
    input,
    setInput,
    textareaRef,
    // Attachment handler
    attachmentHandler,
    // Context menu
    contextMenu,
    // Event handlers
    handleChange,
    handleKeyDown,
    handleSubmit,
    handlePaste,
    handleValueChange,
    handleBlur,
    handleFocus
  };
}