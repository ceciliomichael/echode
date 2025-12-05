import { useCallback } from 'react';
import type { ChatMode } from '../types/chat-mode';
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
    sendingMessageRef: state.sendingMessageRef,
    abortControllerRef: state.abortControllerRef,
    executeToolAndContinue,
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
  }, [state]);

  // Abort stream
  const abortStream = useCallback(() => {
    if (state.abortAndReset()) {
      state.setIsStreaming(false);
    }
  }, [state]);

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
