import { useCallback, useRef } from 'react';
import type { Message, ImageAttachment } from '../../types/chat';
import { toolHistoryApi } from '../../services/tool-history-api';
import { setSessionEditingMessage, setSessionRevertPreview } from '../../utils/session-ui-state';

interface SavedCompressionState {
  messages: Message[] | null;
  tokens: number | null;
  anchorId: string | null;
}

interface EditRevertProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  setIsExecutingTool: React.Dispatch<React.SetStateAction<boolean>>;
  setRevertPreviewMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  setEditingMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  currentSessionIdRef: React.MutableRefObject<string | null>;
  compressedMessagesRef: React.MutableRefObject<Message[] | null>;
  compressedContextTokensRef: React.MutableRefObject<number | null>;
  revertPreviewMessageId: string | null;
  compressionAnchorId: string | null;
  ensureSessionId: () => string;
  sendMessage: (
    content: string,
    attachments?: ImageAttachment[],
    overrideMessages?: Message[],
    isHidden?: boolean,
    forceEchoSearch?: boolean
  ) => Promise<void>;
  clearCompression: () => void;
  restoreCompression: (messages: Message[] | null, tokens: number | null, anchorId: string | null) => void;
  abortAndReset: () => boolean;
}

/**
 * Hook for edit and revert operations
 */
export function useEditRevert({
  messages,
  setMessages,
  setIsStreaming,
  setIsExecutingTool,
  setRevertPreviewMessageId,
  setEditingMessageId,
  currentSessionIdRef,
  compressedMessagesRef,
  compressedContextTokensRef,
  revertPreviewMessageId,
  compressionAnchorId,
  ensureSessionId,
  sendMessage,
  clearCompression,
  restoreCompression,
  abortAndReset,
}: EditRevertProps) {
  // Ref to save compression state during revert preview
  const savedCompressionRef = useRef<SavedCompressionState | null>(null);
  
  const editMessage = useCallback(async (
    messageId: string,
    newContent: string,
    attachments?: ImageAttachment[],
    forceEchoSearch: boolean = false
  ) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    // Step 1: Abort any ongoing API call
    if (abortAndReset()) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    setIsStreaming(false);
    setIsExecutingTool(false);

    // Step 2: Undo tool executions in reverse order
    const messagesToRevert = messages.slice(messageIndex).reverse();
    for (const msg of messagesToRevert) {
      if (msg.toolExecutions && msg.toolExecutions.size > 0) {
        try {
          await toolHistoryApi.undoToolExecutions(msg.toolExecutions);
        } catch (error) {
          console.error('[Chat] Failed to undo tool executions:', error);
        }
      }
    }

    // Step 3: Clear UI state
    setRevertPreviewMessageId(null);
    const sessionId = ensureSessionId();
    setSessionEditingMessage(sessionId, null);
    setSessionRevertPreview(sessionId, null);
    setEditingMessageId(null);

    // Step 4: Get truncated history
    const truncatedMessages = messages.slice(0, messageIndex);

    // Step 5: Handle compressed context based on edit position relative to compression anchor
    // If compressionAnchorId is set, compression happened at that message
    if (compressionAnchorId) {
      const anchorIndex = messages.findIndex(msg => msg.id === compressionAnchorId);
      
      // If editing AFTER the anchor → keep compression (edit is post-compression)
      // If editing AT or BEFORE the anchor → clear compression and re-analyze
      if (anchorIndex !== -1 && messageIndex > anchorIndex) {      } else {        clearCompression();
      }
    }

    // Step 6: Update messages
    setMessages(truncatedMessages);

    // Step 7: Send new message
    await sendMessage(newContent, attachments, truncatedMessages, false, forceEchoSearch);
  }, [
    messages,
    sendMessage,
    ensureSessionId,
    setIsStreaming,
    setIsExecutingTool,
    setRevertPreviewMessageId,
    setEditingMessageId,
    setMessages,
    compressionAnchorId,
    clearCompression,
    abortAndReset,
  ]);

  const handleRevertPreview = useCallback(async (messageId: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) {      return;
    }

    // Save compression state before revert (for restore on cancel)
    savedCompressionRef.current = {
      messages: compressedMessagesRef.current,
      tokens: compressedContextTokensRef.current,
      anchorId: compressionAnchorId,
    };
    // Only clear compression if reverting to a message BEFORE the compression anchor
    // If reverting to a message after compression, the compression is still valid
    if (compressionAnchorId) {
      const anchorIndex = messages.findIndex(msg => msg.id === compressionAnchorId);
      // If revert target is at or before the anchor, clear compression
      if (anchorIndex === -1 || messageIndex <= anchorIndex) {        clearCompression();
      }
    }

    // Abort if streaming
    if (abortAndReset()) {
      setIsStreaming(false);
      setIsExecutingTool(false);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      const messagesToRevert = messages.slice(messageIndex).reverse();
      for (const msg of messagesToRevert) {
        if (msg.toolExecutions && msg.toolExecutions.size > 0) {
          await toolHistoryApi.undoToolExecutions(msg.toolExecutions);
        }
      }

      setRevertPreviewMessageId(messageId);

      const sessionId = ensureSessionId();
      setSessionEditingMessage(sessionId, messageId);
      setSessionRevertPreview(sessionId, messageId);
      setEditingMessageId(messageId);
    } catch (error) {
      console.error('[Chat] Failed to apply revert preview:', error);
    }
  }, [
    messages,
    ensureSessionId,
    abortAndReset,
    setIsStreaming,
    setIsExecutingTool,
    compressedMessagesRef,
    compressedContextTokensRef,
    compressionAnchorId,
    setRevertPreviewMessageId,
    setEditingMessageId,
    clearCompression,
  ]);

  const handleEditStart = useCallback((messageId: string) => {
    const sessionId = ensureSessionId();
    setSessionEditingMessage(sessionId, messageId);
    setEditingMessageId(messageId);
  }, [ensureSessionId, setEditingMessageId]);

  const handleEditCancel = useCallback(() => {
    const sessionId = currentSessionIdRef.current;
    if (sessionId) {
      setSessionEditingMessage(sessionId, null);
    }
    setEditingMessageId(null);
  }, [currentSessionIdRef, setEditingMessageId]);

  const handleCancelRevert = useCallback(async () => {
    if (!revertPreviewMessageId) return;

    try {
      const messageIndex = messages.findIndex(msg => msg.id === revertPreviewMessageId);
      if (messageIndex !== -1) {
        const messagesToReapply = messages.slice(messageIndex);
        for (const msg of messagesToReapply) {
          if (msg.toolExecutions && msg.toolExecutions.size > 0) {
            await toolHistoryApi.redoToolExecutions(msg.toolExecutions);
          }
        }
      }

      // Restore saved compression state
      if (savedCompressionRef.current) {
        const { messages: savedMessages, tokens, anchorId } = savedCompressionRef.current;
        restoreCompression(savedMessages, tokens, anchorId);        savedCompressionRef.current = null;
      }

      setRevertPreviewMessageId(null);

      const sessionId = currentSessionIdRef.current;
      if (sessionId) {
        setSessionEditingMessage(sessionId, null);
        setSessionRevertPreview(sessionId, null);
      }
      setEditingMessageId(null);
    } catch (error) {
      console.error('[Chat] Failed to cancel revert:', error);
    }
  }, [
    revertPreviewMessageId,
    messages,
    currentSessionIdRef,
    setRevertPreviewMessageId,
    setEditingMessageId,
    restoreCompression,
  ]);

  return {
    editMessage,
    handleRevertPreview,
    handleEditStart,
    handleEditCancel,
    handleCancelRevert,
  };
}
