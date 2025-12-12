import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getSystemPrompt } from '../utils/prompts';
import { requestWorkspaceInfo } from '../utils/workspace-info';
import { useWorkspaceContext } from './use-workspace-context';
import type { Message, ImageAttachment } from '../types/chat';
import { ToolExecutor } from '../lib/tool-executor';
import { getToolsForMode } from '../lib/tool-config';
import { getCurrentModel, isVisionCapableModel } from '../utils/vision-utils';
import { supersedePlanningToolsInMessages } from '../utils/planning-utils';

// Import modular helpers
import type { ChatStreamingProps } from './chat-streaming/types';
import { buildChatHistoryWithToolResults } from './chat-streaming/chat-history-builder';
import { handleForcedEchoSearch } from './chat-streaming/forced-echo-search';
import { runStreamingLoop } from './chat-streaming/streaming-loop';

// Re-export types for consumers
export type { ChatStreamingProps } from './chat-streaming/types';

export function useChatStreaming({
  messages,
  setMessages,
  setIsStreaming,
  setIsExecutingTool,
  isStreamingRef,
  isExecutingToolRef,
  sendingMessageRef,
  abortControllerRef,
  toolAbortControllerRef,
  hasStreamedContentRef,
  executeToolAndContinue,
  updateToolExecution,
  isStoppingRef,
  saveSession,
  mode,
}: ChatStreamingProps) {
  const workspace = useWorkspaceContext();

  // Create tool executor for incremental execution
  const toolExecutorRef = { current: null as ToolExecutor | null };
  const getToolExecutor = () => {
    if (!toolExecutorRef.current) {
      const enabledTools = getToolsForMode(mode, false).map(t => t.id);
      // Use toolAbortControllerRef (NOT abortControllerRef) for tool abort.
      // toolAbortControllerRef is only aborted when user clicks Stop, NOT when
      // stream is aborted for tool detection. This allows tools to complete
      // normally during incremental execution while still supporting user abort.
      toolExecutorRef.current = new ToolExecutor({
        enabledTools,
        isStoppingRef,
        abortControllerRef: toolAbortControllerRef,
        mode,
      });
    }
    return toolExecutorRef.current;
  };

  const sendMessage = useCallback(async (content: string, attachments?: ImageAttachment[], overrideMessages?: Message[], isHidden: boolean = false, forceEchoSearch: boolean = false) => {
    // === GUARDS: Prevent concurrent operations ===
    if (isStreamingRef.current) {
      console.error('[sendMessage] BLOCKED: Already streaming');
      return;
    }
    if (isExecutingToolRef.current) {
      console.error('[sendMessage] BLOCKED: Already executing tool');
      return;
    }
    if (sendingMessageRef.current) {
      console.error('[sendMessage] BLOCKED: Already sending message');
      return;
    }

    console.log('[sendMessage] STARTING - No concurrent operation detected');

    // === SETUP: Initialize state flags ===
    sendingMessageRef.current = true;
    isStreamingRef.current = true;
    hasStreamedContentRef.current = false;
    setIsStreaming(true);

    // Request fresh workspace info before sending message
    await requestWorkspaceInfo();

    // === MESSAGE CREATION ===
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date(),
      attachments,
      hidden: isHidden,
    };

    const baseMessages = overrideMessages ?? messages;
    // CRITICAL: Mark any active planning tools as superseded since user is responding with text
    const supersededMessages = supersedePlanningToolsInMessages(baseMessages);
    const nextMessages = [...supersededMessages, userMessage];

    // Save immediately with the precise nextMessages snapshot
    saveSession(nextMessages);
    setMessages(nextMessages);

    // Create assistant message placeholder
    const assistantMessageId = uuidv4();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      // === CONTEXT PREPARATION ===
      const latestWorkspace = window.workspaceContext || workspace;
      const systemPrompt = getSystemPrompt(latestWorkspace, mode);
      const messagesToSend = overrideMessages !== undefined ? overrideMessages : supersededMessages;

      // === MODEL CAPABILITIES ===
      const currentModel = getCurrentModel();
      const modelSupportsVision = isVisionCapableModel(currentModel);

      // === FORCED ECHO SEARCH (delegated to helper) ===
      if (forceEchoSearch && (mode === 'agent' || mode === 'plan' || mode === 'ask')) {
        await handleForcedEchoSearch({
          content,
          attachments,
          systemPrompt,
          messagesToSend,
          assistantMessageId,
          modelSupportsVision,
          mode,
          setMessages,
          setIsExecutingTool,
          executeToolAndContinue,
        });
        return; // Exit early, tool execution handles continuation
      }

      // === BUILD CHAT HISTORY (delegated to helper) ===
      const finalChatHistory = buildChatHistoryWithToolResults({
        systemPrompt,
        contextMessages: messagesToSend,
        content,
        attachments,
        modelSupportsVision,
        mode,
      });

      // === STREAMING LOOP (delegated to helper) ===
      const streamResult = await runStreamingLoop({
        finalChatHistory,
        messagesToSend,
        content,
        attachments,
        assistantMessageId,
        mode,
        isStoppingRef,
        abortControllerRef,
        hasStreamedContentRef,
        setMessages,
        setIsExecutingTool,
        updateToolExecution,
        executeToolAndContinue,
        getToolExecutor,
      });

      // If tool execution handled continuation, we're done
      if (streamResult.handledByToolExecution) {
        return;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';

      // Only overwrite content with an error if nothing was ever streamed
      if (!hasStreamedContentRef.current) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: `Error: ${errorMessage}` }
              : msg
          )
        );
      }
    } finally {
      // Always reset streaming state when done
      isStreamingRef.current = false;
      setIsStreaming(false);
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
      }
      sendingMessageRef.current = false;

      // Save session after stream completion
      saveSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, workspace, executeToolAndContinue, setMessages, setIsStreaming, setIsExecutingTool, isStreamingRef, isExecutingToolRef, sendingMessageRef, abortControllerRef, hasStreamedContentRef, saveSession, mode, updateToolExecution]);

  return { sendMessage };
}

