import { useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Message } from '../../types/chat';
import type { ChatSession } from '../../types/chat-session';
import { storageService } from '../../utils/storage';
import { loadSessionUiState } from '../../utils/session-ui-state';

interface SessionManagementProps {
  messagesRef: React.MutableRefObject<Message[]>;
  currentSessionIdRef: React.MutableRefObject<string | null>;
  compressedMessagesRef: React.MutableRefObject<Message[] | null>;
  compressedContextTokensRef: React.MutableRefObject<number | null>;
  compressionAnchorId: string | null;
  isStreamingRef: React.MutableRefObject<boolean>;
  isExecutingToolRef: React.MutableRefObject<boolean>;
  abortAndReset: () => boolean;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setCurrentSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  setEditingMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  setRevertPreviewMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  setCompressedMessages: React.Dispatch<React.SetStateAction<Message[] | null>>;
  setCompressedContextTokens: React.Dispatch<React.SetStateAction<number | null>>;
  setCompressionAnchorId: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * Hook for managing chat session persistence and loading
 */
export function useSessionManagement({
  messagesRef,
  currentSessionIdRef,
  compressedMessagesRef,
  compressedContextTokensRef,
  compressionAnchorId,
  isStreamingRef,
  isExecutingToolRef,
  abortAndReset,
  setMessages,
  setCurrentSessionId,
  setEditingMessageId,
  setRevertPreviewMessageId,
  setCompressedMessages,
  setCompressedContextTokens,
  setCompressionAnchorId,
}: SessionManagementProps) {
  const ensureSessionId = useCallback(() => {
    if (!currentSessionIdRef.current) {
      const newId = uuidv4();
      currentSessionIdRef.current = newId;
      storageService.setCurrentSessionId(newId);
    }
    return currentSessionIdRef.current;
  }, [currentSessionIdRef]);

  const saveCurrentSession = useCallback((overrideMessages?: Message[]) => {
    const currentMessages = overrideMessages ?? messagesRef.current;
    if (currentMessages.length === 0) return;

    const sessionId = ensureSessionId();

    // Build compression context if it exists
    const compressedContext = compressedMessagesRef.current && compressionAnchorId
      ? {
        messages: compressedMessagesRef.current.map(msg => ({
          ...msg,
          timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
          toolExecutions: msg.toolExecutions ? Array.from(msg.toolExecutions.entries()) : undefined,
        })),
        tokenCount: compressedContextTokensRef.current ?? 0,
        anchorId: compressionAnchorId,
      }
      : undefined;

    const session: ChatSession = {
      id: sessionId,
      title: storageService.generateTitle(currentMessages),
      timestamp: Date.now(),
      createdAt: Date.now(),
      messages: currentMessages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
        toolExecutions: msg.toolExecutions ? Array.from(msg.toolExecutions.entries()) : undefined,
      })),
      metadata: {
        messageCount: currentMessages.length,
        preview: storageService.getPreview(currentMessages),
      },
      compressedContext,
    };

    storageService.saveSession(session);
  }, [ensureSessionId, messagesRef, compressedMessagesRef, compressedContextTokensRef, compressionAnchorId]);

  const loadSession = useCallback((sessionId: string) => {
    // If currently streaming or executing tools, abort and save first
    if (isStreamingRef.current || isExecutingToolRef.current) {

      // Save current session state before aborting
      const currentMessages = messagesRef.current;
      if (currentMessages.length > 0) {
        saveCurrentSession(currentMessages);
      }

      // Abort the stream/tool execution
      abortAndReset();
    }

    if (window.vscode) {
      window.vscode.postMessage({ type: 'getSession', sessionId });
    }
  }, [isStreamingRef, isExecutingToolRef, messagesRef, saveCurrentSession, abortAndReset]);

  // Listen for session events from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === 'sessionLoaded') {
        const session = message.session as ChatSession | null;

        if (!session) {
          currentSessionIdRef.current = null;
          setCurrentSessionId(null);
          storageService.clearCurrentSessionId();
          setMessages([]);
          setEditingMessageId(null);
          setRevertPreviewMessageId(null);
          setCompressedMessages(null);
          setCompressedContextTokens(null);
          setCompressionAnchorId(null);
          compressedMessagesRef.current = null;
          compressedContextTokensRef.current = null;
          return;
        }

        currentSessionIdRef.current = session.id;
        setCurrentSessionId(session.id);
        storageService.setCurrentSessionId(session.id);

        if (session.uiState) {
          loadSessionUiState(session.id, session.uiState);
          setEditingMessageId(session.uiState.editingMessageId);
          setRevertPreviewMessageId(session.uiState.revertPreviewMessageId);
        } else {
          setEditingMessageId(null);
          setRevertPreviewMessageId(null);
        }

        // Helper to convert session messages to Message type
        const convertMessages = (msgs: typeof session.messages): Message[] => msgs.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          hidden: msg.hidden,
          attachments: msg.attachments,
          toolExecutions: msg.toolExecutions ? new Map(
            msg.toolExecutions.map(([id, execution]) => {
              let fixedExecution = execution;

              const isPlanningTool =
                fixedExecution.toolName === 'plan_navigator' ||
                fixedExecution.toolName === 'plan_handoff';

              if (isPlanningTool && !fixedExecution.result) {
                const preservedData = fixedExecution.toolName === 'plan_navigator'
                  ? { question: fixedExecution.parameters.question, options: fixedExecution.parameters.options }
                  : {};
                fixedExecution = {
                  ...fixedExecution,
                  result: { success: true, data: preservedData },
                };
              }

              if (fixedExecution.status === 'executing' && fixedExecution.result) {
                const finalStatus = fixedExecution.result.success ? 'completed' : 'error';
                fixedExecution = { ...fixedExecution, status: finalStatus };
              }

              return [id, fixedExecution];
            })
          ) : undefined,
        }));

        setMessages(convertMessages(session.messages));

        // Restore compression state if it exists
        if (session.compressedContext) {
          const restoredCompressed = convertMessages(session.compressedContext.messages);
          setCompressedMessages(restoredCompressed);
          setCompressedContextTokens(session.compressedContext.tokenCount);
          setCompressionAnchorId(session.compressedContext.anchorId);
          compressedMessagesRef.current = restoredCompressed;
          compressedContextTokensRef.current = session.compressedContext.tokenCount;
        } else {
          // Clear compression state if session has none
          setCompressedMessages(null);
          setCompressedContextTokens(null);
          setCompressionAnchorId(null);
          compressedMessagesRef.current = null;
          compressedContextTokensRef.current = null;
        }
      } else if (message.type === 'sessionDeleted' && message.sessionId) {
        if (currentSessionIdRef.current === message.sessionId) {
          setMessages([]);
          currentSessionIdRef.current = null;
          setCurrentSessionId(null);
          storageService.clearCurrentSessionId();
          setEditingMessageId(null);
          setRevertPreviewMessageId(null);
          // Clear compression state when session is deleted
          setCompressedMessages(null);
          setCompressedContextTokens(null);
          setCompressionAnchorId(null);
          compressedMessagesRef.current = null;
          compressedContextTokensRef.current = null;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentSessionIdRef, setMessages, setCurrentSessionId, setEditingMessageId, setRevertPreviewMessageId, compressedMessagesRef, compressedContextTokensRef, setCompressedMessages, setCompressedContextTokens, setCompressionAnchorId]);

  return {
    ensureSessionId,
    saveCurrentSession,
    loadSession,
  };
}
