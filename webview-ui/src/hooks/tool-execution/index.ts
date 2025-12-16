/**
 * Tool Execution Module
 *
 * Main entry point for tool execution functionality.
 * Composes all sub-modules into a cohesive hook.
 */
import { useCallback, useRef, useEffect } from 'react';
import { useWorkspaceContext } from '../use-workspace-context';
import type { Message, ImageAttachment } from '../../types/chat';
import type { ChatMessage } from '../../types/chat-api';
import { extractToolBlocks } from '../../lib/tool-parser';
import { ToolExecutor } from '../../lib/tool-executor';
import { getToolsForMode } from '../../lib/tool-config';
import { generateToolExecutionId } from '../../lib/tool-execution-tracker';
import type { ToolExecutionState } from '../../types/tool';
import { buildContinuationHistory } from '../../utils/continuation-builder';

import type { ToolExecutionHookProps, ToolExecutionContext } from './types';
import { executeSingleTool } from './single-executor';
import { runContinuationStream } from './continuation-stream';

// Re-export types for external use
export type { ToolExecutionHookProps, ToolExecutionContext, TodoItem } from './types';

/**
 * Hook for executing tools and managing continuation streams
 *
 * This hook orchestrates tool execution by:
 * 1. Detecting tool blocks in assistant responses
 * 2. Executing tools sequentially
 * 3. Managing continuation streams with retry logic
 * 4. Handling diagnostics
 */
export function useToolExecution({
  setMessages,
  setIsExecutingTool,
  setIsStreaming,
  isStreamingRef,
  isStoppingRef,
  abortControllerRef,
  sendingMessageRef,
  messagesRef,
  updateToolExecution,
  currentTodos = [],
  saveSession,
  mode,
}: ToolExecutionHookProps) {
  const workspace = useWorkspaceContext();

  // Track diagnostic fix attempts per file to prevent infinite loops
  const diagnosticAttemptsRef = useRef<Record<string, number>>({});

  // Initialize tool executor with mode-aware enabled tools
  const toolExecutorRef = useRef<ToolExecutor | null>(null);

  // Use ref to track current mode to avoid stale closures in async callbacks
  const modeRef = useRef(mode);

  // Recreate tool executor when mode changes to refresh enabled tools
  useEffect(() => {
    modeRef.current = mode;
    const enabledTools = getToolsForMode(mode, false).map(t => t.id);
    toolExecutorRef.current = new ToolExecutor({
      enabledTools,
      isStoppingRef,
      abortControllerRef,
      mode,
    });
  }, [mode, isStoppingRef, abortControllerRef]);

  const executeToolAndContinue = useCallback(
    async (
      assistantContent: string,
      assistantMessageId: string,
      _previousHistory: ChatMessage[],
      messagesToSend: Message[],
      userContent: string,
      toolIndex = 0,
      userAttachments?: ImageAttachment[],
      bufferedToolResults?: string[]
    ) => {
      if (!toolExecutorRef.current) {
        return;
      }

      // Check if user stopped before starting continuation
      if (isStoppingRef.current) {
        setIsExecutingTool(false);
        return;
      }

      // If no userAttachments provided, try to find from the latest user message in history
      // This ensures images are preserved across tool execution continuations
      const effectiveUserAttachments = userAttachments ?? (() => {
        const lastUserMsg = [...messagesRef.current].reverse().find(m => m.role === 'user');
        return lastUserMsg?.attachments;
      })();

      // Build execution context for sub-modules
      const context: ToolExecutionContext = {
        workspace,
        isStoppingRef,
        abortControllerRef,
        setIsExecutingTool,
        setIsStreaming,
        isStreamingRef,
        sendingMessageRef,
        setMessages,
        updateToolExecution,
        messagesRef,
        currentTodos,
        saveSession,
        mode: modeRef.current,
        diagnosticAttemptsRef,
      };

      try {

        // If we have buffered results from incremental execution, skip to continuation
        if (bufferedToolResults && bufferedToolResults.length > 0) {
          await handleBufferedResults(
            bufferedToolResults,
            assistantContent,
            assistantMessageId,
            messagesToSend,
            userContent,
            toolIndex,
            effectiveUserAttachments,
            context,
            executeToolAndContinue
          );
          return;
        }

        // Keep executing tool state active
        setIsExecutingTool(true);

        // Extract all tool blocks and get the current one by index
        const toolBlocks = extractToolBlocks(assistantContent);
        const toolBlock = toolBlocks[toolIndex];

        if (!toolBlock) {
          setIsExecutingTool(false);
          return;
        }

        // Execute single tool
        await executeSingleTool({
          toolBlock,
          assistantContent,
          assistantMessageId,
          toolIndex,
          messagesToSend,
          userContent,
          userAttachments: effectiveUserAttachments,
          toolExecutor: toolExecutorRef.current,
          context,
          executeToolAndContinue,
        });
      } catch (error) {
        console.error('[ToolExecution] Execution error:', error);
        handleExecutionError(
          error,
          assistantContent,
          assistantMessageId,
          toolIndex,
          messagesRef,
          updateToolExecution
        );
      } finally {
        setIsExecutingTool(false);
        isStreamingRef.current = false;
        setIsStreaming(false);
        abortControllerRef.current = null;
        sendingMessageRef.current = false;

        // Save session after tool execution completion
        saveSession();
      }
    },
    [workspace, updateToolExecution, setMessages, setIsExecutingTool, setIsStreaming, isStreamingRef, isStoppingRef, abortControllerRef, sendingMessageRef, currentTodos, messagesRef, saveSession]
  );

  return { executeToolAndContinue };
}

/**
 * Handle buffered results from incremental execution
 */
async function handleBufferedResults(
  bufferedToolResults: string[],
  assistantContent: string,
  assistantMessageId: string,
  messagesToSend: Message[],
  userContent: string,
  toolIndex: number,
  userAttachments: ImageAttachment[] | undefined,
  context: ToolExecutionContext,
  executeToolAndContinue: (
    assistantContent: string,
    assistantMessageId: string,
    previousHistory: ChatMessage[],
    messagesToSend: Message[],
    userContent: string,
    toolIndex?: number,
    userAttachments?: ImageAttachment[],
    bufferedToolResults?: string[]
  ) => Promise<void>
): Promise<void> {

  const toolResultText = bufferedToolResults.join('\n\n');
  const diagnosticsText = ''; // Diagnostics already handled during incremental execution

  // Build continuation history for chat
  const latestWorkspace = (window.workspaceContext || context.workspace)!;

  const continuationHistory = buildContinuationHistory(
    latestWorkspace,
    context.messagesRef.current,
    userContent,
    assistantContent,
    toolResultText,
    diagnosticsText,
    context.currentTodos,
    context.mode,
    userAttachments,
    toolIndex === 0  // isFirstIteration: only add user message on first tool
  );

  // Continue streaming with buffered results
  context.setIsExecutingTool(false);

  await runContinuationStream({
    continuationHistory,
    assistantContent,
    assistantMessageId,
    messagesToSend,
    userContent,
    nextToolIndex: toolIndex + bufferedToolResults.length,
    userAttachments,
    abortControllerRef: context.abortControllerRef,
    isStoppingRef: context.isStoppingRef,
    setMessages: context.setMessages,
    setIsExecutingTool: context.setIsExecutingTool,
    executeToolAndContinue,
    logPrefix: '[ToolExecution:Buffered]',
    mode: context.mode,
  });
}

/**
 * Handle execution errors
 */
function handleExecutionError(
  error: unknown,
  assistantContent: string,
  assistantMessageId: string,
  toolIndex: number,
  messagesRef: React.MutableRefObject<Message[]>,
  updateToolExecution: (messageId: string, toolExecutionId: string, state: ToolExecutionState) => void
): void {
  // Try to extract tool info for error state update
  // But ONLY if the tool hasn't already completed successfully
  const toolBlocks = extractToolBlocks(assistantContent);
  const toolBlock = toolBlocks[toolIndex];

  if (toolBlock) {
    const toolExecutionId = generateToolExecutionId(assistantMessageId, toolIndex);

    // Check if this tool execution already has a successful result
    const currentMessages = messagesRef.current;
    const assistantMsg = currentMessages.find(m => m.id === assistantMessageId);
    const existingExecution = assistantMsg?.toolExecutions?.get(toolExecutionId);

    // Only set error state if tool hasn't already completed successfully
    // HTTP errors during continuation shouldn't overwrite successful tool execution
    if (!existingExecution?.result?.success) {
      const errorState: ToolExecutionState = {
        toolExecutionId,
        toolName: toolBlock.toolName,
        parameters: toolBlock.parameters,
        status: 'error',
        result: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        startedAt: Date.now(),
        completedAt: Date.now(),
      };
      updateToolExecution(assistantMessageId, toolExecutionId, errorState);
    } else {
      // Tool completed successfully but continuation failed
      // Log warning but don't overwrite the successful tool result
    }
  }
}