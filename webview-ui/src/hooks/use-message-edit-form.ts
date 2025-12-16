import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type FormEvent, type ChangeEvent } from 'react';
import { usePasteHandler } from './use-paste-handler';
import { useContextMenu, type UseContextMenuReturn } from './use-context-menu';
import { useAttachmentHandler, type UseAttachmentHandlerReturn } from './use-attachment-handler';
import { useDropdownDirection } from './use-dropdown-direction';
import { mentionRegex } from '../utils/context-mentions';
import { buildAllAttachedFileBlocks, extractTextAndAttachmentsFromContent, type DocumentAttachment } from '../utils/document-utils';
import type { ChatMode } from '../types/chat-mode';
import type { InputWithHighlightsRef } from '../components/ui/input-with-highlights';

interface UseMessageEditFormOptions {
  initialContent: string;
  initialAttachments?: DocumentAttachment[];
  onSubmit: (content: string, attachments?: undefined, forceEchoSearch?: boolean) => void;
  onCancel: () => void;
  onSave?: (content: string) => void;
  mode?: ChatMode;
}

export interface UseMessageEditFormReturn {
  // Content state
  editContent: string;
  setEditContent: (value: string) => void;
  textareaRef: React.RefObject<InputWithHighlightsRef | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  dropdownDirection: 'up' | 'down';
  
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
}

/**
 * Parses initial content to extract mentions and populate mentionPathMap
 * Converts full mentions @[label](path) to short display format @[label]
 */
function parseInitialMentions(
  content: string,
  mentionPathMap: React.RefObject<Map<string, string>>
): string {
  return content.replace(mentionRegex, (match, label, path) => {
    if (path) {
      // Handle collision: if label already mapped to different path, rename
      let effectiveLabel = label;
      const basename = label;
      let counter = 1;
      while (mentionPathMap.current.has(effectiveLabel) && mentionPathMap.current.get(effectiveLabel) !== path) {
        effectiveLabel = `${basename} (${counter})`;
        counter++;
      }
      mentionPathMap.current.set(effectiveLabel, path);
      return `@[${effectiveLabel}]`;
    }
    return match;
  });
}

export function useMessageEditForm({
  initialContent,
  initialAttachments,
  onSubmit,
  onCancel,
  onSave,
  mode
}: UseMessageEditFormOptions): UseMessageEditFormReturn {
  // Parse initial content to extract text and attachments
  const parsed = extractTextAndAttachmentsFromContent(initialContent);
  
  const [editContent, setEditContent] = useState(parsed.text);
  const textareaRef = useRef<InputWithHighlightsRef | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownDirection = useDropdownDirection(containerRef);

  // Initialize attachment handler with parsed or provided attachments
  const attachmentHandler = useAttachmentHandler({
    initialAttachments: initialAttachments || parsed.attachments,
    initialImageAttachments: [],
    disabled: false
  });

  // Initialize context menu
  const contextMenu = useContextMenu({
    input: editContent,
    setInput: setEditContent,
    textareaRef
  });

  // Initialize paste handler
  const { handlePaste } = usePasteHandler({
    attachments: attachmentHandler.attachments,
    setAttachments: attachmentHandler.setAttachments,
    imageAttachments: attachmentHandler.imageAttachments,
    setImageAttachments: attachmentHandler.setImageAttachments,
    disabled: false
  });

  // Parse initial content to populate mentionPathMap (only once on mount)
  useEffect(() => {
    if (contextMenu.mentionPathMap.current.size === 0) {
      const newContent = parseInitialMentions(initialContent, contextMenu.mentionPathMap);
      if (newContent !== initialContent) {
        setEditContent(newContent);
      }
    }
  }, [initialContent, contextMenu.mentionPathMap]);

  // Focus and auto-resize on mount
  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      if (textareaRef.current) {
        const textarea = textareaRef.current;
        textarea.focus();
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Auto-resize on content change
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editContent]);

  // Handle click outside to cancel
  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      const target = event.target as Node | null;
      if (!containerRef.current || !target) {
        return;
      }

      if (containerRef.current.contains(target)) {
        return;
      }

      const element = target as HTMLElement;
      if (element.closest('[data-edit-outside-ignore="true"]')) {
        return;
      }

      onCancel();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  const handleSubmit = useCallback((e: FormEvent, forceEchoSearch: boolean = false) => {
    e.preventDefault();
    if (editContent.trim()) {
      // Build <attached_file> blocks
      const attachmentBlocks = buildAllAttachedFileBlocks(attachmentHandler.attachments);

      // Expand mentions to full format: @[label](path)
      let expandedContent = editContent.trim();
      expandedContent = expandedContent.replace(mentionRegex, (match, label, path) => {
        if (path) return match;
        const storedPath = contextMenu.mentionPathMap.current.get(label);
        return storedPath ? `@[${label}](${storedPath})` : match;
      });

      const newContent = expandedContent + attachmentBlocks;
      onSubmit(newContent, undefined, forceEchoSearch);
      if (onSave) {
        onSave(newContent);
      }
    } else {
      onCancel();
    }
  }, [editContent, attachmentHandler.attachments, contextMenu.mentionPathMap, onSubmit, onSave, onCancel]);

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart;
    setEditContent(newValue);
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

      // Regular Enter: submit edit
      e.preventDefault();
      handleSubmit(e, false);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  }, [contextMenu, handleSubmit, mode, onCancel]);

  const handleValueChange = useCallback((newValue: string, newCursorPos: number) => {
    setEditContent(newValue);
    contextMenu.updateCursorPosition(newValue, newCursorPos);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  }, [contextMenu]);

  return {
    // Content state
    editContent,
    setEditContent,
    textareaRef,
    containerRef,
    dropdownDirection,
    // Attachment handler
    attachmentHandler,
    // Context menu
    contextMenu,
    // Event handlers
    handleChange,
    handleKeyDown,
    handleSubmit,
    handlePaste,
    handleValueChange
  };
}