import { useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getSystemPrompt } from '../utils/prompts';
import { requestWorkspaceInfo } from '../utils/workspace-info';
import { useWorkspaceContext } from './use-workspace-context';
import type { Message, ImageAttachment } from '../types/chat';
import { ToolExecutor } from '../lib/tool-executor';
import { getToolsForMode } from '../lib/tool-config';
import { getCurrentModel, isVisionCapableModel } from '../utils/vision-utils';
import { storageService } from '../utils/storage';
import type { ChatMode } from '../types/chat-mode';

// Import modular helpers
import type { ChatStreamingProps, LockedModelConfig } from './chat-streaming/types';
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
  isStreaming,
  isExecutingTool,
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
  messagesRef,
}: ChatStreamingProps) {
  const workspace = useWorkspaceContext();

  // Create tool executor for incremental execution
  const toolExecutorRef = useRef<ToolExecutor | null>(null);

  // Use ref to track current mode to avoid stale closures in async callbacks
  const modeRef = useRef(mode);

  // Update ref when mode changes
  useEffect(() => {
    modeRef.current = mode;
    // Also reset tool executor when mode changes to ensure we get fresh tools
    toolExecutorRef.current = null;
  }, [mode]);

  // Auto-save session when streaming or tool execution finishes
  // This ensures we save the FINAL state including all tool results and React updates
  useEffect(() => {
    // Only save if we are not streaming, not executing a tool, and we have actually streamed something
    if (!isStreaming && !isExecutingTool && hasStreamedContentRef.current) {
      saveSession(messagesRef.current);
    }
  }, [isStreaming, isExecutingTool, saveSession, hasStreamedContentRef, messagesRef]);

  const getToolExecutor = (lockedMode?: ChatMode) => {
    // Determine which mode we need tools for: lockedMode (if executing a specific plan/action) or current mode
    const targetMode = lockedMode ?? modeRef.current;

    // Check if we need to create a new executor (either none exists, or mode mismatch)
    // We check toolExecutorRef.current.mode (which we exposed as public readonly)
    if (!toolExecutorRef.current || toolExecutorRef.current.mode !== targetMode) {
      const enabledTools = getToolsForMode(targetMode, false).map(t => t.id);
      
      // Use toolAbortControllerRef (NOT abortControllerRef) for tool abort.
      // toolAbortControllerRef is only aborted when user clicks Stop, NOT when
      // stream is aborted for tool detection. This allows tools to complete
      // normally during incremental execution while still supporting user abort.
      toolExecutorRef.current = new ToolExecutor({
        enabledTools,
        isStoppingRef,
        abortControllerRef: toolAbortControllerRef,
        mode: targetMode,
      });
    }
    return toolExecutorRef.current;
  };

  const sendMessage = useCallback(async (content: string, attachments?: ImageAttachment[], overrideMessages?: Message[], isHidden: boolean = false, forceEchoSearch: boolean = false, lockedMode?: ChatMode) => {
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

    // === CONTEXT PREPARATION ===
    const latestWorkspace = window.workspaceContext || workspace;
    
    // Determine current mode: prefer locked mode if provided (e.g. from plan continuation),
    // otherwise use current mode ref (handles race condition where mode updates during async flow)
    const currentMode = lockedMode ?? modeRef.current;
    
    // === LOCK CONFIG ===
    // Capture the current provider/model/mode at the START of streaming
    // This ensures the same settings are used throughout tool execution and continuation
    // even if user changes settings while AI is working
    const modeModel = storageService.getModeModel(currentMode);
    const lockedConfig: LockedModelConfig = {
      provider: modeModel.provider,
      model: modeModel.model,
      mode: currentMode,
    };

    // === MESSAGE CREATION ===
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date(),
      attachments,
      hidden: isHidden,
      provider: lockedConfig.provider,
      model: lockedConfig.model,
      mode: lockedConfig.mode,
    };

    const baseMessages = overrideMessages ?? messages;
    const nextMessages = [...baseMessages, userMessage];

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
      provider: lockedConfig.provider,
      model: lockedConfig.model,
      mode: lockedConfig.mode,
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const systemPrompt = getSystemPrompt(latestWorkspace, currentMode);

      const messagesToSend = overrideMessages !== undefined ? overrideMessages : baseMessages;

      // === MODEL CAPABILITIES ===
      const currentModel = getCurrentModel();
      const modelSupportsVision = isVisionCapableModel(currentModel);

      // === FORCED ECHO SEARCH (delegated to helper) ===
      if (forceEchoSearch && (currentMode === 'agent' || currentMode === 'plan' || currentMode === 'ask')) {
        await handleForcedEchoSearch({
          content,
          attachments,
          systemPrompt,
          messagesToSend,
          assistantMessageId,
          modelSupportsVision,
          mode: currentMode,
          setMessages,
          setIsExecutingTool,
          executeToolAndContinue,
          lockedConfig,
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
        mode: currentMode,
      });

      // === STREAMING LOOP (delegated to helper) ===
      const streamResult = await runStreamingLoop({
        finalChatHistory,
        messagesToSend,
        content,
        attachments,
        assistantMessageId,
        mode: currentMode,
        lockedConfig,
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
        const errorContent = `Error: ${errorMessage}`;
        
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: errorContent }
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, workspace, executeToolAndContinue, setMessages, setIsStreaming, setIsExecutingTool, isStreamingRef, isExecutingToolRef, sendingMessageRef, abortControllerRef, hasStreamedContentRef, saveSession, mode, updateToolExecution]);

  return { sendMessage };
}
