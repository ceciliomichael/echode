import { useState, useRef, useEffect, useCallback } from 'react';
import type { Message } from '../../types/chat';
import { storageService } from '../../utils/storage';

/**
 * Hook for managing core chat state (messages, streaming, compression)
 */
export function useChatState() {
  // Core message state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  // Compression state
  const [compressedContextTokens, setCompressedContextTokens] = useState<number | null>(null);
  const [compressedMessages, setCompressedMessages] = useState<Message[] | null>(null);
  // ID of the message that triggered compression (anchor point)
  const [compressionAnchorId, setCompressionAnchorId] = useState<string | null>(null);

  // Edit/revert state
  const [revertPreviewMessageId, setRevertPreviewMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // Session state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    storageService.getCurrentSessionId()
  );

  // Refs for synchronous access
  const currentSessionIdRef = useRef<string | null>(storageService.getCurrentSessionId());
  const abortControllerRef = useRef<AbortController | null>(null);
  const sendingMessageRef = useRef(false);
  const isStreamingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const messagesRef = useRef<Message[]>(messages);
  const compressedMessagesRef = useRef<Message[] | null>(null);
  const compressedContextTokensRef = useRef<number | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    compressedMessagesRef.current = compressedMessages;
    compressedContextTokensRef.current = compressedContextTokens;
  }, [compressedMessages, compressedContextTokens]);

  // Sync session state with ref on mount
  useEffect(() => {
    setCurrentSessionId(currentSessionIdRef.current);
  }, []);

  // Helper functions to modify refs (React Compiler compatible)
  const clearCompression = useCallback(() => {
    compressedMessagesRef.current = null;
    compressedContextTokensRef.current = null;
    setCompressedMessages(null);
    setCompressedContextTokens(null);
    setCompressionAnchorId(null);
  }, []);

  const updateCompressedRefs = useCallback((msgs: Message[] | null, tokens: number | null) => {
    compressedMessagesRef.current = msgs;
    compressedContextTokensRef.current = tokens;
  }, []);

  const restoreCompression = useCallback((msgs: Message[] | null, tokens: number | null, anchorId: string | null) => {
    compressedMessagesRef.current = msgs;
    compressedContextTokensRef.current = tokens;
    setCompressedMessages(msgs);
    setCompressedContextTokens(tokens);
    setCompressionAnchorId(anchorId);
  }, []);

  const clearSessionRef = useCallback(() => {
    currentSessionIdRef.current = null;
  }, []);

  const abortAndReset = useCallback(() => {
    if (abortControllerRef.current) {
      isStoppingRef.current = true;
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      isStreamingRef.current = false;
      sendingMessageRef.current = false;
      isStoppingRef.current = false;
      setIsCompressing(false); // Stop compression if in progress
      return true;
    }
    return false;
  }, []);

  return {
    // State
    messages,
    setMessages,
    isStreaming,
    setIsStreaming,
    isExecutingTool,
    setIsExecutingTool,
    isCompressing,
    setIsCompressing,
    compressedContextTokens,
    setCompressedContextTokens,
    compressedMessages,
    setCompressedMessages,
    compressionAnchorId,
    setCompressionAnchorId,
    revertPreviewMessageId,
    setRevertPreviewMessageId,
    editingMessageId,
    setEditingMessageId,
    currentSessionId,
    setCurrentSessionId,
    // Refs
    currentSessionIdRef,
    abortControllerRef,
    sendingMessageRef,
    isStreamingRef,
    isStoppingRef,
    messagesRef,
    compressedMessagesRef,
    compressedContextTokensRef,
    // Helper functions for ref mutations
    clearCompression,
    updateCompressedRefs,
    restoreCompression,
    clearSessionRef,
    abortAndReset,
  };
}
