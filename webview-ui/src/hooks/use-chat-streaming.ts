import { useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getSystemPrompt } from '../utils/prompts';
import { requestWorkspaceInfo } from '../utils/workspace-info';
import { useWorkspaceContext } from './use-workspace-context';
import type { Message, ImageAttachment } from '../types/chat';
import { ToolExecutor } from '../lib/tool-executor';
import { getToolsForMode } from '../lib/tool-config';
import { getCurrentModel, isVisionCapableModel } from '../utils/vision-utils';
import { supersedePlanningToolsInMessages } from '../utils/planning-utils';
import { storageService } from '../utils/storage';
import { useContextSummarization } from './use-context-summarization';

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
  const toolExecutorRef = useRef<ToolExecutor | null>(null);

  // Use ref to track current mode to avoid stale closures in async callbacks
  const modeRef = useRef(mode);

  // Track system prompt for summarization (updated when workspace changes)
  const systemPromptRef = useRef('');

  // Update ref when mode changes
  useEffect(() => {
    modeRef.current = mode;
    // Also reset tool executor when mode changes to ensure we get fresh tools
    toolExecutorRef.current = null;
  }, [mode]);

  // Get context settings for summarization
  const getContextSettings = () => {
    const settings = storageService.getSettings();
    return settings.contextSettings;
  };

  // Initialize summarization hook with current system prompt
  const { checkAndSummarize, isCompressing } = useContextSummarization({
    systemPrompt: systemPromptRef.current,
    contextSettings: getContextSettings(),
  });

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
        mode: modeRef.current,
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
      // Use ref to get the freshest mode (handles race condition where mode updates during async flow)
      const currentMode = modeRef.current;
      const systemPrompt = getSystemPrompt(latestWorkspace, currentMode);
      
      // Update system prompt ref for summarization hook
      systemPromptRef.current = systemPrompt;
      
      let messagesToSend = overrideMessages !== undefined ? overrideMessages : supersededMessages;

      // === CONTEXT SUMMARIZATION ===
      // Check if we need to compress context before sending
      const summarizationResult = await checkAndSummarize(messagesToSend, content);
      if (summarizationResult.wasCompressed) {
        console.log(`[sendMessage] Context compressed: ${summarizationResult.originalTokens} → ${summarizationResult.compressedTokens} tokens`);
        messagesToSend = summarizationResult.messages;
        // Update the messages state with compressed version
        setMessages((prev) => {
          // Keep the assistant placeholder, replace the rest with compressed messages
          const assistantMsg = prev.find(m => m.id === assistantMessageId);
          return assistantMsg ? [...messagesToSend, userMessage, assistantMsg] : [...messagesToSend, userMessage];
        });
        // Save the compressed session
        saveSession([...messagesToSend, userMessage]);
      }

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

  return { sendMessage, isCompressing };
}

