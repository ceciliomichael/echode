import { useCallback, useState } from 'react';
import type { ChatMode } from '../types/chat-mode';
import type { DocumentAttachment } from '../utils/document-utils';
import { useToolExecution } from './use-tool-execution';
import { useChatStreaming } from './use-chat-streaming';
import { storageService } from '../utils/storage';
import {
  useChatState,
  useSessionManagement,
  useMessageActions,
  useEditRevert,
} from './chat';

export function useStreamingChat(
  _currentTodos?: Array<{ id: string; content: string; status: string }>,
  mode: ChatMode = 'agent'
) {
  // Core state management
  const state = useChatState();

  const [abortedUserInput, setAbortedUserInput] = useState<string | null>(null);
  const [abortedAttachments, setAbortedAttachments] = useState<DocumentAttachment[] | null>(null);

  // Session management (save, load, ensure ID)
  const {
    ensureSessionId,
    saveCurrentSession,
    loadSession,
  } = useSessionManagement({
    messagesRef: state.messagesRef,
    currentSessionIdRef: state.currentSessionIdRef,
    compressedMessagesRef: state.compressedMessagesRef,
    compressedContextTokensRef: state.compressedContextTokensRef,
    compressionAnchorId: state.compressionAnchorId,
    setMessages: state.setMessages,
    setCurrentSessionId: state.setCurrentSessionId,
    setEditingMessageId: state.setEditingMessageId,
    setRevertPreviewMessageId: state.setRevertPreviewMessageId,
    setCompressedMessages: state.setCompressedMessages,
    setCompressedContextTokens: state.setCompressedContextTokens,
    setCompressionAnchorId: state.setCompressionAnchorId,
  });

  // Message update actions
  const {
    updateMessage,
    updateToolExecution,
    updateToolResultData,
    supersedePlanningTools,
  } = useMessageActions({
    setMessages: state.setMessages,
  });

  // Tool execution hook
  const { executeToolAndContinue } = useToolExecution({
    setMessages: state.setMessages,
    setIsExecutingTool: state.setIsExecutingTool,
    setIsStreaming: state.setIsStreaming,
    isStreamingRef: state.isStreamingRef,
    isStoppingRef: state.isStoppingRef,
    abortControllerRef: state.abortControllerRef,
    sendingMessageRef: state.sendingMessageRef,
    updateToolExecution,
    messagesRef: state.messagesRef,
    saveSession: saveCurrentSession,
    mode,
  });

  // Chat streaming hook
  const { sendMessage } = useChatStreaming({
    messages: state.messages,
    setMessages: state.setMessages,
    setIsStreaming: state.setIsStreaming,
    setIsExecutingTool: state.setIsExecutingTool,
    setIsCompressing: state.setIsCompressing,
    setCompressedContextTokens: state.setCompressedContextTokens,
    setCompressedMessages: state.setCompressedMessages,
    setCompressionAnchorId: state.setCompressionAnchorId,
    compressedMessagesRef: state.compressedMessagesRef,
    compressedContextTokensRef: state.compressedContextTokensRef,
    isStreamingRef: state.isStreamingRef,
    isExecutingToolRef: state.isExecutingToolRef,
    sendingMessageRef: state.sendingMessageRef,
    abortControllerRef: state.abortControllerRef,
    hasStreamedContentRef: state.hasStreamedContentRef,
    executeToolAndContinue,
    updateToolExecution,
    isStoppingRef: state.isStoppingRef,
    saveSession: saveCurrentSession,
    mode,
  });

  // Edit and revert operations
  const {
    editMessage,
    handleRevertPreview,
    handleEditStart,
    handleEditCancel,
    handleCancelRevert,
  } = useEditRevert({
    messages: state.messages,
    setMessages: state.setMessages,
    setIsStreaming: state.setIsStreaming,
    setIsExecutingTool: state.setIsExecutingTool,
    setRevertPreviewMessageId: state.setRevertPreviewMessageId,
    setEditingMessageId: state.setEditingMessageId,
    currentSessionIdRef: state.currentSessionIdRef,
    compressedMessagesRef: state.compressedMessagesRef,
    compressedContextTokensRef: state.compressedContextTokensRef,
    revertPreviewMessageId: state.revertPreviewMessageId,
    compressionAnchorId: state.compressionAnchorId,
    ensureSessionId,
    sendMessage,
    clearCompression: state.clearCompression,
    restoreCompression: state.restoreCompression,
    abortAndReset: state.abortAndReset,
  });

  // Clear chat
  const clearChat = useCallback(() => {
    state.setMessages([]);
    state.clearCompression();
    state.clearSessionRef();
    state.setCurrentSessionId(null);
    storageService.clearCurrentSessionId();
    state.setEditingMessageId(null);
    state.setRevertPreviewMessageId(null);
    setAbortedUserInput(null);
    setAbortedAttachments(null);
  }, [state]);

  // Abort stream and tool execution
  const abortStream = useCallback(() => {
    // Use refs for synchronous checks - React state may not have updated yet when user clicks Stop fast
    const isActive = state.isStreamingRef.current || state.isExecutingToolRef.current || state.isCompressing;
    if (isActive && !state.hasStreamedContentRef.current) {
      const currentMessages = state.messagesRef.current;
      if (currentMessages.length >= 2) {
        const last = currentMessages[currentMessages.length - 1];
        const prev = currentMessages[currentMessages.length - 2];

        if (last.role === 'assistant' && prev.role === 'user' && !prev.hidden) {
          setAbortedUserInput(prev.content);
          // Document attachments are embedded in message content as <attached_file> blocks
          // so we don't need to restore them separately
          setAbortedAttachments(null);
          const updatedMessages = currentMessages.slice(0, currentMessages.length - 2);
          state.setMessages(updatedMessages);
          saveCurrentSession(updatedMessages);
        }
      }
    }

    // abortAndReset now handles all state cleanup including
    // isStreaming, isExecutingTool, and sets isStoppingRef for async abort
    state.abortAndReset();
  }, [state, saveCurrentSession]);

  return {
    messages: state.messages,
    isStreaming: state.isStreaming,
    isExecutingTool: state.isExecutingTool,
    isCompressing: state.isCompressing,
    compressedContextTokens: state.compressedContextTokens,
    compressedMessages: state.compressedMessages,
    revertPreviewMessageId: state.revertPreviewMessageId,
    editingMessageId: state.editingMessageId,
    currentSessionId: state.currentSessionId,
    abortedUserInput,
    abortedAttachments,
    sendMessage,
    editMessage,
    updateMessage,
    clearChat,
    abortStream,
    loadSession,
    handleEditStart,
    handleEditCancel,
    handleRevertPreview,
    handleCancelRevert,
    updateToolResultData,
    supersedePlanningTools,
    saveCurrentSession,
  };
}
