import { useCallback } from 'react';
import type { Message, ImageAttachment } from '../../types/chat';
import { toolHistoryApi } from '../../services/tool-history-api';
import { setSessionEditingMessage, setSessionRevertPreview } from '../../utils/session-ui-state';

interface EditRevertProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  setIsExecutingTool: React.Dispatch<React.SetStateAction<boolean>>;
  setRevertPreviewMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  setEditingMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  currentSessionIdRef: React.MutableRefObject<string | null>;
  revertPreviewMessageId: string | null;
  ensureSessionId: () => string;
  sendMessage: (
    content: string,
    attachments?: ImageAttachment[],
    overrideMessages?: Message[],
    isHidden?: boolean,
    forceEchoSearch?: boolean
  ) => Promise<void>;
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
  revertPreviewMessageId,
  ensureSessionId,
  sendMessage,
  abortAndReset,
}: EditRevertProps) {
  const editMessage = useCallback(async (
    messageId: string,
    newContent: string,
    attachments?: ImageAttachment[],
    forceEchoSearch: boolean = false
  ) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) {return;}

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

    // Step 4: Truncate history to the revert point
    const truncatedMessages = messages.slice(0, messageIndex);

    // Step 5: Update messages
    setMessages(truncatedMessages);

    // Step 6: Send new message
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
    abortAndReset,
  ]);

  const handleRevertPreview = useCallback(async (messageId: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) {
      return;
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
    setRevertPreviewMessageId,
    setEditingMessageId,
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
    if (!revertPreviewMessageId) {return;}

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
  ]);

  return {
    editMessage,
    handleRevertPreview,
    handleEditStart,
    handleEditCancel,
    handleCancelRevert,
  };
}
