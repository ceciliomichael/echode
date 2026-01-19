import { useState, useRef, useEffect, useCallback } from 'react';
import type { Message } from '../../types/chat';

/**
 * Hook for managing core chat state (messages, streaming)
 */
export function useChatState() {
  // Core message state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true); // Start true for initial restore

  // Edit/revert state
  const [revertPreviewMessageId, setRevertPreviewMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // Session state - always start fresh on mount
  // Users should explicitly load a session from history to continue one
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Refs for synchronous access - start with null to prevent overwriting previous sessions
  const currentSessionIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Dedicated abort controller for tools - only aborted on user stop, NOT on stream stop for tool detection
  const toolAbortControllerRef = useRef<AbortController>(new AbortController());
  const sendingMessageRef = useRef(false);
  const isStreamingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const isExecutingToolRef = useRef(false);
  const messagesRef = useRef<Message[]>(messages);
  const hasStreamedContentRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    isExecutingToolRef.current = isExecutingTool;
  }, [isExecutingTool]);

  const clearSessionRef = useCallback(() => {
    currentSessionIdRef.current = null;
  }, []);

  const abortAndReset = useCallback(() => {
    // Set stopping flag FIRST - this will be checked by async tool execution
    // Do NOT reset isStoppingRef here - let tool execution code reset it after handling
    isStoppingRef.current = true;

    // Abort any pending HTTP request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Abort any running tools (especially sub-agents like echo_search)
    // Then create a fresh controller for future tool executions
    toolAbortControllerRef.current.abort();
    toolAbortControllerRef.current = new AbortController();

    // Reset all streaming/execution states
    isStreamingRef.current = false;
    isExecutingToolRef.current = false;
    sendingMessageRef.current = false;
    hasStreamedContentRef.current = false;
    setIsExecutingTool(false);
    setIsStreaming(false);

    // Schedule reset of stopping flag after current execution cycle
    // This ensures async code has time to check the flag
    setTimeout(() => {
      isStoppingRef.current = false;
    }, 100);

    return true;
  }, [setIsExecutingTool, setIsStreaming]);

  return {
    // State
    messages,
    setMessages,
    isStreaming,
    setIsStreaming,
    isExecutingTool,
    setIsExecutingTool,
    isLoadingSession,
    setIsLoadingSession,
    revertPreviewMessageId,
    setRevertPreviewMessageId,
    editingMessageId,
    setEditingMessageId,
    currentSessionId,
    setCurrentSessionId,
    // Refs
    currentSessionIdRef,
    abortControllerRef,
    toolAbortControllerRef,
    sendingMessageRef,
    isStreamingRef,
    isStoppingRef,
    isExecutingToolRef,
    hasStreamedContentRef,
    messagesRef,
    // Helper functions for ref mutations
    clearSessionRef,
    abortAndReset,
  };
}
