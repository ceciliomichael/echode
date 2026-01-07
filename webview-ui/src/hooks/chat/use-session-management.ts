import { useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Message } from '../../types/chat';
import type { ChatSession } from '../../types/chat-session';
import { storageService } from '../../utils/storage';
import { loadSessionUiState } from '../../utils/session-ui-state';

interface SessionManagementProps {
  messagesRef: React.MutableRefObject<Message[]>;
  currentSessionIdRef: React.MutableRefObject<string | null>;
  isStreamingRef: React.MutableRefObject<boolean>;
  isExecutingToolRef: React.MutableRefObject<boolean>;
  abortAndReset: () => boolean;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setCurrentSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  setEditingMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  setRevertPreviewMessageId: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * Hook for managing chat session persistence and loading
 */
export function useSessionManagement({
  messagesRef,
  currentSessionIdRef,
  isStreamingRef,
  isExecutingToolRef,
  abortAndReset,
  setMessages,
  setCurrentSessionId,
  setEditingMessageId,
  setRevertPreviewMessageId,
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
    if (currentMessages.length === 0) {return;}

    const sessionId = ensureSessionId();

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
    };

    storageService.saveSession(session);
  }, [ensureSessionId, messagesRef]);

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
          // CRITICAL: Don't clear localStorage if there was an error loading the session.
          // This prevents losing the session reference during extension restarts or transient failures.
          // Only clear if the session was explicitly not found (notFound: true) and no error occurred.
          const isError = message.error === true;
          const isNotFound = message.notFound === true;
          const requestedSessionId = message.sessionId as string | undefined;
          
          if (isError) {
            // Error loading session - keep the localStorage reference intact
            // The session file might still exist, just temporarily unreadable
            console.warn('[SessionManagement] Error loading session, keeping reference:', requestedSessionId);
            // Don't clear anything - user can retry or the extension can recover
            return;
          }
          
          if (isNotFound && requestedSessionId) {
            // Session genuinely doesn't exist - clear only if this was a specific session request
            // (not a "getLatestSession" which returns null when there are no sessions)
            currentSessionIdRef.current = null;
            setCurrentSessionId(null);
            storageService.clearCurrentSessionId();
            setMessages([]);
            setEditingMessageId(null);
            setRevertPreviewMessageId(null);
            return;
          }
          
          // For "latest" requests with no session, just set empty state but don't clear stored ID
          // (there might be a stored ID that we want to try loading separately)
          if (message.request === 'latest') {
            setMessages([]);
            setEditingMessageId(null);
            setRevertPreviewMessageId(null);
            return;
          }
          
          // Fallback for unknown cases - be conservative, don't clear localStorage
          console.warn('[SessionManagement] Session load returned null with unknown state:', message);
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
        const convertMessages = (msgs: typeof session.messages): Message[] => msgs.map(msg => {
          const reasoningBlocks =
            msg.reasoningBlocks ??
            (msg.reasoningContent && msg.reasoningContent.trim() ? [msg.reasoningContent] : undefined);

          return {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            reasoningBlocks,
            timestamp: new Date(msg.timestamp),
            hidden: msg.hidden,
            attachments: msg.attachments,
            toolExecutions: msg.toolExecutions ? new Map(
              msg.toolExecutions.map(([id, execution]) => {
              let fixedExecution = execution;

              // Fix interrupted executions that have results
              if (fixedExecution.status === 'executing' && fixedExecution.result) {
                const finalStatus = fixedExecution.result.success ? 'completed' : 'error';
                fixedExecution = { ...fixedExecution, status: finalStatus };
              }

              // Fix plan tools that should be awaiting_user but were saved with wrong status
              // This handles cases where the tool has awaitsUserAction but status wasn't updated
              const resultData = fixedExecution.result?.data as Record<string, unknown> | undefined;
              const isPlanTool = fixedExecution.toolName === 'plan';
              const hasUserAction = Boolean(resultData && 'userAction' in resultData && resultData.userAction);
              
              // Check if this is a plan tool in a mode that requires user action
              const executionMode =
                (resultData && 'mode' in resultData ? (resultData.mode as string | undefined) : undefined) ||
                (fixedExecution.parameters?.mode as string | undefined);
              const actionType = resultData && 'actionType' in resultData ? (resultData.actionType as string | undefined) : undefined;
              
              // Check both mode and actionType to be more robust
              const isInteractivePlanMode = isPlanTool && (
                (executionMode && ['create_plan', 'update_plan', 'handoff'].includes(executionMode)) ||
                (actionType && ['verify_plan', 'start_implementation'].includes(actionType))
              );
              
              // Check if explicitly marked as awaiting user action
              const explicitlyAwaitsUser =
                Boolean(resultData && 'awaitsUserAction' in resultData && resultData.awaitsUserAction === true);

              // If it should await user action AND hasn't been acted upon yet, force status
              if ((isInteractivePlanMode || explicitlyAwaitsUser) && !hasUserAction && fixedExecution.status !== 'awaiting_user') {
                fixedExecution = { ...fixedExecution, status: 'awaiting_user' };
              }

              return [id, fixedExecution];
              })
            ) : undefined,
          };
        });

        setMessages(convertMessages(session.messages));
      } else if (message.type === 'sessionDeleted' && message.sessionId) {
        if (currentSessionIdRef.current === message.sessionId) {
          setMessages([]);
          currentSessionIdRef.current = null;
          setCurrentSessionId(null);
          storageService.clearCurrentSessionId();
          setEditingMessageId(null);
          setRevertPreviewMessageId(null);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentSessionIdRef, setMessages, setCurrentSessionId, setEditingMessageId, setRevertPreviewMessageId]);

  return {
    ensureSessionId,
    saveCurrentSession,
    loadSession,
  };
}

