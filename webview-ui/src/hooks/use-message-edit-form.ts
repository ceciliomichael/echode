import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type FormEvent, type ChangeEvent } from 'react';
import { usePasteHandler } from './use-paste-handler';
import { useContextMenu, type UseContextMenuReturn } from './use-context-menu';
import { useAttachmentHandler, type UseAttachmentHandlerReturn } from './use-attachment-handler';
import { useDropdownDirection } from './use-dropdown-direction';
import { mentionRegex } from '../utils/context-mentions';
import { buildAllAttachedFileBlocks, extractTextAndAttachmentsFromContent, type DocumentAttachment } from '../utils/document-utils';
import type { ChatMode } from '../types/chat-mode';
import type { InputWithHighlightsRef } from '../components/ui/input-with-highlights';
import type { ImageAttachment } from '../types/chat';

interface UseMessageEditFormOptions {
  initialContent: string;
  initialAttachments?: DocumentAttachment[];
  initialImageAttachments?: ImageAttachment[];
  onSubmit: (content: string, imageAttachments?: ImageAttachment[]) => void;
  onCancel: () => void;
  onSave?: (content: string, imageAttachments?: ImageAttachment[], attachments?: DocumentAttachment[]) => void;
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
  handleSubmit: (e: FormEvent) => void;
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  handleValueChange: (newValue: string, newCursorPos: number) => void;
}

/**
 * Parses initial content to extract mentions and build a new mentionPathMap
 * Converts full mentions @[label](path) to short display format @[label]
 * Returns both the new content and the new map entries
 */
function parseInitialMentions(
  content: string,
  existingMap: Map<string, string>
): { newContent: string; newEntries: Map<string, string> } {
  const newEntries = new Map<string, string>();
  
  const newContent = content.replace(mentionRegex, (match, label, path) => {
    if (path) {
      // Handle collision: if label already mapped to different path, rename
      let effectiveLabel = label;
      const basename = label;
      let counter = 1;
      while (
        (existingMap.has(effectiveLabel) && existingMap.get(effectiveLabel) !== path) ||
        (newEntries.has(effectiveLabel) && newEntries.get(effectiveLabel) !== path)
      ) {
        effectiveLabel = `${basename} (${counter})`;
        counter++;
      }
      newEntries.set(effectiveLabel, path);
      return `@[${effectiveLabel}]`;
    }
    return match;
  });
  
  return { newContent, newEntries };
}

export function useMessageEditForm({
  initialContent,
  initialAttachments,
  initialImageAttachments,
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
    initialImageAttachments: initialImageAttachments ?? [],
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
    attachmentsRef: attachmentHandler.attachmentsRef,
    setAttachments: attachmentHandler.setAttachments,
    imageAttachmentsRef: attachmentHandler.imageAttachmentsRef,
    setImageAttachments: attachmentHandler.setImageAttachments,
    disabled: false
  });

  // Parse initial content to populate mentionPathMap (only once on mount)
  // Using a ref to track if we've already parsed to avoid re-parsing on mentionPathMap changes
  const hasParsedRef = useRef(false);
  
  useEffect(() => {
    if (!hasParsedRef.current && contextMenu.mentionPathMap.size === 0) {
      hasParsedRef.current = true;
      const { newContent, newEntries } = parseInitialMentions(initialContent, contextMenu.mentionPathMap);
      
      // Update the mentionPathMap with parsed entries
      if (newEntries.size > 0) {
        const mergedMap = new Map(contextMenu.mentionPathMap);
        newEntries.forEach((value, key) => mergedMap.set(key, value));
        // We need to use a function that updates the map - this is exposed via context menu
        // Since setMentionPathMap is not directly exposed, we'll populate via the ref
        // Actually, we need to add a way to set the map. Let's use clearMentionPathMap pattern
        // For now, we'll iterate and set via the internal ref
        newEntries.forEach((path, label) => {
          contextMenu.mentionPathMapRef.current.set(label, path);
        });
      }
      
      if (newContent !== initialContent) {
        setTimeout(() => {
          setEditContent(newContent);
        }, 0);
      }
    }
  }, [initialContent, contextMenu.mentionPathMap, contextMenu.mentionPathMapRef]);

  // Focus on mount (resizing is handled by InputWithHighlights)
  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      if (textareaRef.current) {
        const textarea = textareaRef.current;
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Scroll into view on mount to ensure form is visible if it expands off-screen
  useEffect(() => {
    // Small delay to allow layout to settle (e.g., after expansion animation)
    const timeoutId = setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }
    }, 150);

    return () => clearTimeout(timeoutId);
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

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (editContent.trim()) {
      // Use ref to get current attachment state (avoids stale closure)
      const currentAttachments = attachmentHandler.attachmentsRef.current;
      const currentImageAttachments = attachmentHandler.imageAttachmentsRef.current;
      
      // Build <attached_file> blocks
      const attachmentBlocks = buildAllAttachedFileBlocks(currentAttachments);

      // Expand mentions to full format: @[label](path)
      let expandedContent = editContent.trim();
      expandedContent = expandedContent.replace(mentionRegex, (match, label, path) => {
        if (path) {return match;}
        // Use ref to get current map value (avoids stale closure)
        const storedPath = contextMenu.mentionPathMapRef.current.get(label);
        return storedPath ? `@[${label}](${storedPath})` : match;
      });

      const newContent = expandedContent + attachmentBlocks;
      onSubmit(newContent, currentImageAttachments);
      if (onSave) {
        onSave(newContent, currentImageAttachments, currentAttachments);
      }
    } else {
      onCancel();
    }
  }, [editContent, attachmentHandler.attachmentsRef, attachmentHandler.imageAttachmentsRef, contextMenu.mentionPathMapRef, onSubmit, onSave, onCancel]);

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
      // Regular Enter: submit edit
      e.preventDefault();
      handleSubmit(e);
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