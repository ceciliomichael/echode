import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Message } from '../types/chat';
import type { ToolExecutionState } from '../types/tool';
import type { ChatSession } from '../types/chat-session';
import { useToolExecution } from './use-tool-execution';
import { useChatStreaming } from './use-chat-streaming';
import { storageService } from '../utils/storage';
import { toolHistoryApi } from '../services/tool-history-api';
import { setSessionEditingMessage, setSessionRevertPreview, loadSessionUiState } from '../utils/session-ui-state';

export function useStreamingChat(currentTodos?: Array<{ id: string; content: string; status: string }>) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const [revertPreviewMessageId, setRevertPreviewMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(storageService.getCurrentSessionId());
  const currentSessionIdRef = useRef<string | null>(storageService.getCurrentSessionId());
  const abortControllerRef = useRef<AbortController | null>(null);
  const sendingMessageRef = useRef(false);
  const isStreamingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const messagesRef = useRef<Message[]>(messages);

  // Keep messagesRef in sync with messages state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const ensureSessionId = useCallback(() => {
    if (!currentSessionIdRef.current) {
      const newId = uuidv4();
      currentSessionIdRef.current = newId;
      storageService.setCurrentSessionId(newId);
    }
    return currentSessionIdRef.current;
  }, []);

  // Sync state with ref
  useEffect(() => {
    setCurrentSessionId(currentSessionIdRef.current);
  }, []);

  useEffect(() => {
    if (messages.length === 0 || isStreaming || isExecutingTool) {
      return;
    }

    const sessionId = ensureSessionId();

    const session: ChatSession = {
      id: sessionId,
      title: storageService.generateTitle(messages),
      timestamp: Date.now(),
      createdAt: Date.now(),
      messages: messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
        // Serialize toolExecutions Map to array for JSON storage
        toolExecutions: msg.toolExecutions ? Array.from(msg.toolExecutions.entries()) : undefined,
      })),
      metadata: {
        messageCount: messages.length,
        preview: storageService.getPreview(messages),
      },
    };

    storageService.saveSession(session);
  }, [messages, isStreaming, isExecutingTool, ensureSessionId]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      if (message.type === 'sessionLoaded' && message.session) {
        const session = message.session as ChatSession;
        currentSessionIdRef.current = session.id;
        setCurrentSessionId(session.id);
        storageService.setCurrentSessionId(session.id);
        
        // Load and restore session UI state from database
        if (session.uiState) {
          loadSessionUiState(session.id, session.uiState);
          setEditingMessageId(session.uiState.editingMessageId);
          setRevertPreviewMessageId(session.uiState.revertPreviewMessageId);
        } else {
          // Fallback for sessions without UI state
          setEditingMessageId(null);
          setRevertPreviewMessageId(null);
        }
        
        setMessages(session.messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          hidden: msg.hidden,
          // Deserialize toolExecutions array back to Map and fix stale 'executing' states
          toolExecutions: msg.toolExecutions ? new Map(
            msg.toolExecutions.map(([id, execution]) => {
              // Fix tool executions stuck in 'executing' state from saved history
              if (execution.status === 'executing' && execution.result) {
                // If there's a result, determine final status
                const finalStatus = execution.result.success ? 'completed' : 'error';
                return [id, { ...execution, status: finalStatus }];
              }
              return [id, execution];
            })
          ) : undefined,
        })));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const updateMessage = useCallback((messageId: string, newContent: string) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? { ...msg, content: newContent }
          : msg
      )
    );
  }, []);

  const updateToolExecution = useCallback((messageId: string, toolExecutionId: string, state: ToolExecutionState) => {
    setMessages(prev =>
      prev.map(msg => {
        if (msg.id === messageId) {
          const toolExecutions = new Map(msg.toolExecutions || []);
          toolExecutions.set(toolExecutionId, state);
          return { ...msg, toolExecutions };
        }
        return msg;
      })
    );
  }, []);

  // Tool execution hook
  const { executeToolAndContinue } = useToolExecution({
    setMessages,
    setIsExecutingTool,
    setIsStreaming,
    isStreamingRef,
    isStoppingRef,
    abortControllerRef,
    sendingMessageRef,
    updateToolExecution,
    messagesRef,
    currentTodos,
  });

  // Chat streaming hook
  const { sendMessage } = useChatStreaming({
    messages,
    setMessages,
    setIsStreaming,
    setIsExecutingTool,
    isStreamingRef,
    sendingMessageRef,
    abortControllerRef,
    executeToolAndContinue,
  });

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) {return;}

    // Step 1: Abort any ongoing API call and wait for cleanup
    if (abortControllerRef.current) {
      console.log('[Chat] Aborting ongoing stream before edit');
      isStoppingRef.current = true;
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Reset stopping flag
    isStoppingRef.current = false;
    isStreamingRef.current = false;
    setIsStreaming(false);
    setIsExecutingTool(false);
    sendingMessageRef.current = false;
    
    // Step 2: Undo all tool executions from messages after the edited one
    const messagesToRevert = messages.slice(messageIndex);
    for (const msg of messagesToRevert) {
      if (msg.toolExecutions && msg.toolExecutions.size > 0) {
        try {
          console.log('[Chat] Undoing tool executions for message', msg.id);
          await toolHistoryApi.undoToolExecutions(msg.toolExecutions);
        } catch (error) {
          console.error('[Chat] Failed to undo tool executions:', error);
        }
      }
    }
    
    // Step 3: Clear revert preview and session UI state
    setRevertPreviewMessageId(null);
    const sessionId = ensureSessionId();
    setSessionEditingMessage(sessionId, null);
    setSessionRevertPreview(sessionId, null);
    setEditingMessageId(null);
    
    // Step 4: Get truncated message history (everything before the edited message)
    const truncatedMessages = messages.slice(0, messageIndex);
    
    // Step 5: Clear all messages subsequent to the one being edited (Cursor-style)
    setMessages(truncatedMessages);

    // Step 6: Send the new message with explicit message history
    await sendMessage(newContent, truncatedMessages);
  }, [messages, sendMessage, ensureSessionId]);

  const clearChat = useCallback(() => {
    setMessages([]);
    currentSessionIdRef.current = null;
    setCurrentSessionId(null);
    storageService.clearCurrentSessionId();
    setEditingMessageId(null);
    setRevertPreviewMessageId(null);
  }, []);

  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      console.log('Aborting stream');
      isStoppingRef.current = true;
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      // Immediately set streaming to false (both ref and state)
      isStreamingRef.current = false;
      setIsStreaming(false);
      // Reset sending flag to allow next message
      sendingMessageRef.current = false;
      isStoppingRef.current = false;
    }
  }, []);

  const loadSession = useCallback((sessionId: string) => {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'getSession', sessionId });
    }
  }, []);

  const handleRevertPreview = useCallback(async (messageId: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) {
      console.warn('[Chat] Message not found', messageId);
      return;
    }

    // If AI is streaming, abort it first
    if (abortControllerRef.current) {
      console.log('[Chat] Aborting stream for revert preview');
      isStoppingRef.current = true;
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      
      isStreamingRef.current = false;
      setIsStreaming(false);
      setIsExecutingTool(false);
      sendingMessageRef.current = false;
      isStoppingRef.current = false;
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      // Undo all tool executions from messages after the target message
      const messagesToRevert = messages.slice(messageIndex);
      for (const msg of messagesToRevert) {
        if (msg.toolExecutions && msg.toolExecutions.size > 0) {
          console.log('[Chat] Undoing tool executions for revert preview, message', msg.id);
          await toolHistoryApi.undoToolExecutions(msg.toolExecutions);
        }
      }
      
      setRevertPreviewMessageId(messageId);
      
      // Set session UI state to remember we're in revert preview
      const sessionId = ensureSessionId();
      setSessionEditingMessage(sessionId, messageId);
      setSessionRevertPreview(sessionId, messageId);
      setEditingMessageId(messageId);
    } catch (error) {
      console.error('[Chat] Failed to apply revert preview:', error);
    }
  }, [messages, ensureSessionId]);

  const handleEditStart = useCallback((messageId: string) => {
    const sessionId = ensureSessionId();
    setSessionEditingMessage(sessionId, messageId);
    setEditingMessageId(messageId);
  }, [ensureSessionId]);

  const handleEditCancel = useCallback(() => {
    const sessionId = currentSessionIdRef.current;
    if (sessionId) {
      setSessionEditingMessage(sessionId, null);
    }
    setEditingMessageId(null);
  }, []);

  const handleCancelRevert = useCallback(async () => {
    if (!revertPreviewMessageId) {
      return;
    }

    try {
      console.log('[Chat] Cancelling revert preview - re-applying tool executions');
      
      // Find the message we reverted from
      const messageIndex = messages.findIndex(msg => msg.id === revertPreviewMessageId);
      if (messageIndex !== -1) {
        // Re-apply tool executions from messages after the revert point
        const messagesToReapply = messages.slice(messageIndex);
        for (const msg of messagesToReapply) {
          if (msg.toolExecutions && msg.toolExecutions.size > 0) {
            console.log('[Chat] Redoing tool executions for message', msg.id);
            await toolHistoryApi.redoToolExecutions(msg.toolExecutions);
          }
        }
      }
      
      setRevertPreviewMessageId(null);
      
      // Clear session UI state
      const sessionId = currentSessionIdRef.current;
      if (sessionId) {
        setSessionEditingMessage(sessionId, null);
        setSessionRevertPreview(sessionId, null);
      }
      setEditingMessageId(null);
    } catch (error) {
      console.error('[Chat] Failed to cancel revert:', error);
    }
  }, [revertPreviewMessageId, messages]);

  return {
    messages,
    isStreaming,
    isExecutingTool,
    revertPreviewMessageId,
    editingMessageId,
    currentSessionId,
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
  };
};