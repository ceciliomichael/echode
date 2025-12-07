import { useCallback, useRef, useEffect } from 'react';
import { chatApi } from '../services/chat-api';
import { useWorkspaceContext } from './use-workspace-context';
import type { Message, ImageAttachment } from '../types/chat';
import type { ChatMessage } from '../types/chat-api';
import type { ChatMode } from '../types/chat-mode';
import { hasCompleteToolBlock, extractToolBlocks, trimToFirstCompleteToolBlock, extractParallelizableToolBlocks } from '../lib/tool-parser';
import { ToolExecutor } from '../lib/tool-executor';
import { getToolsForMode } from '../lib/tool-config';
import type { ToolExecutionState } from '../types/tool';
import { createToolExecutionState, updateToolExecutionStatus, updateToolExecutionProgress, generateToolExecutionId } from '../lib/tool-execution-tracker';
import { isFileModificationTool as checkIsFileModificationTool, extractDiagnosticsFromResult } from '../utils/diagnostic-utils';
import { buildContinuationHistory } from '../utils/continuation-builder';
import { executeToolWithStopCheck, type ToolProgressCallback } from '../utils/tool-execution-helpers';
import { getContextCompressor } from '../services/context-compressor';
import { storageService } from '../utils/storage';
import { getSystemPrompt } from '../utils/prompts';
/**
 * Extract diagnostics from tool result for file modification tools (Roo Code approach)
 * Diagnostics are already included in the tool result - no external fetch needed
 */
function getDiagnosticsFromToolResult(
  executedTool: { toolName: string; result?: { success: boolean; data?: unknown } } | undefined,
  diagnosticAttemptsRef: React.MutableRefObject<Record<string, number>>
): string {
  if (!executedTool?.result?.success || !('data' in executedTool.result) || !executedTool.result.data) {
    return '';
  }

  const data = executedTool.result.data as Record<string, unknown>;
  const filePath = (data.path as string) || 'unknown';
  const isModificationTool = checkIsFileModificationTool(executedTool.toolName);

  // Only file modification tools have diagnostics in the result
  if (!isModificationTool) {
    return '';
  }

  const newProblemsMessage = extractDiagnosticsFromResult(executedTool.toolName, executedTool.result);
  if (newProblemsMessage) {
    // Track attempts for file modification tools
    const currentAttempts = (diagnosticAttemptsRef.current[filePath] || 0) + 1;
    diagnosticAttemptsRef.current[filePath] = currentAttempts;
    const maxIterations = 3;

    // Add attempt tracking to the message
    let instruction = '';
    if (currentAttempts < maxIterations) {
      instruction = `\n\n[INSTRUCTION: The file you just modified has lint/compile errors. Review the diagnostics above and fix them. This is attempt ${currentAttempts}/${maxIterations}.]`;
    } else if (currentAttempts === maxIterations) {
      instruction = `\n\n[INSTRUCTION: The file still has lint/compile errors. This is your final attempt (${currentAttempts}/${maxIterations}). Review carefully and fix all issues.]`;
    } else {
      instruction = `\n\n[NOTE: Maximum fix attempts (${maxIterations}) reached for this file. Diagnostics are shown for your reference, but you should acknowledge and move forward unless the user requests further fixes.]`;
    }

    return newProblemsMessage + instruction;
  } else {
    // No diagnostics found - reset attempts counter
    if (diagnosticAttemptsRef.current[filePath]) {
      console.log(`[Diagnostics] No errors found for ${filePath} - resetting attempt counter`);
      delete diagnosticAttemptsRef.current[filePath];
    }
    return '';
  }
}

/**
 * Extract diagnostics from tool results for multiple files (Roo Code approach)
 * Diagnostics are already included in the tool results - no external fetch needed
 */
function getDiagnosticsFromToolResultsParallel(
  executedTools: Array<{ toolName: string; result?: { success: boolean; data?: unknown }; state: ToolExecutionState }>,
  diagnosticAttemptsRef: React.MutableRefObject<Record<string, number>>
): string[] {
  console.log(`[ToolExecution] Processing diagnostics for ${executedTools.length} files...`);

  const results = executedTools.map(({ toolName, result }) => {
    if (!result?.success || !('data' in result) || !result.data) {
      return '';
    }

    const data = result.data as Record<string, unknown>;
    const filePath = (data.path as string) || 'unknown';
    const isModificationTool = checkIsFileModificationTool(toolName);

    // Only file modification tools have diagnostics in the result
    if (!isModificationTool) {
      return '';
    }

    const newProblemsMessage = extractDiagnosticsFromResult(toolName, result);
    if (newProblemsMessage) {
      // Track attempts for file modification tools
      const currentAttempts = (diagnosticAttemptsRef.current[filePath] || 0) + 1;
      diagnosticAttemptsRef.current[filePath] = currentAttempts;
      const maxIterations = 3;

      // Add attempt tracking to the message
      let instruction = '';
      if (currentAttempts < maxIterations) {
        instruction = `\n\n[INSTRUCTION: The file you just modified has lint/compile errors. Review the diagnostics above and fix them. This is attempt ${currentAttempts}/${maxIterations}.]`;
      } else if (currentAttempts === maxIterations) {
        instruction = `\n\n[INSTRUCTION: The file still has lint/compile errors. This is your final attempt (${currentAttempts}/${maxIterations}). Review carefully and fix all issues.]`;
      } else {
        instruction = `\n\n[NOTE: Maximum fix attempts (${maxIterations}) reached for this file. Diagnostics are shown for your reference, but you should acknowledge and move forward unless the user requests further fixes.]`;
      }

      return newProblemsMessage + instruction;
    } else {
      // No diagnostics found - reset attempts counter
      if (diagnosticAttemptsRef.current[filePath]) {
        console.log(`[Diagnostics] No errors found for ${filePath} - resetting attempt counter`);
        delete diagnosticAttemptsRef.current[filePath];
      }
      return '';
    }
  });

  console.log(`[ToolExecution] Completed diagnostics processing for ${executedTools.length} files`);
  return results.filter((r): r is string => r.length > 0);
}

/**
 * Estimate tokens from text (~4 chars per token)
 */
function estimateTokens(text: string): number {
  if (!text) { return 0; }
  return Math.ceil(text.length / 4);
}

/**
 * Build context messages for continuation, applying lossless compression if needed.
 * This uses the same ContextCompressorService as send-time compression but keeps
 * compression local to the continuation (no React state coupling).
 */
async function buildCompressedContextIfNeeded(
  workspace: ReturnType<typeof useWorkspaceContext>,
  messages: Message[],
  toolResultText: string,
  diagnosticsText: string,
  mode: ChatMode,
): Promise<Message[]> {
  const settings = storageService.getSettings();
  const contextSettings = settings.contextSettings;

  // If compression isn't configured, just return original messages
  if (!contextSettings || !contextSettings.summarizerModel) {
    return messages;
  }

  const compressor = getContextCompressor(contextSettings);

  const systemPrompt = getSystemPrompt(workspace, mode);
  const systemPromptTokens = estimateTokens(systemPrompt);

  // Treat tool results + diagnostics as the new content added for this continuation
  const newContentTokens = estimateTokens(toolResultText) + estimateTokens(diagnosticsText);

  const analysis = compressor.analyzeContext(
    messages,
    systemPromptTokens,
    newContentTokens,
  );

  if (!analysis.needsCompression || analysis.middleMessages.length === 0) {
    return messages;
  }

  console.log('[ToolExecution] Context compression triggered for continuation:', {
    estimatedTokens: analysis.estimatedTokens,
    firstMessages: analysis.firstMessages.length,
    middleMessages: analysis.middleMessages.length,
    recentMessages: analysis.recentMessages.length,
  });

  const summaryResult = await compressor.requestSummary(analysis.middleMessages);

  if (!summaryResult.success || !summaryResult.summary) {
    console.warn('[ToolExecution] Continuation context compression failed:', summaryResult.error);
    return messages;
  }

  const compressedMessages: Message[] = [];
  compressedMessages.push(...analysis.firstMessages);
  compressedMessages.push({
    id: `compressed-summary-${Date.now()}`,
    role: 'assistant',
    content: `[Context Summary]\n${summaryResult.summary}`,
    timestamp: new Date(),
  });
  compressedMessages.push(...analysis.recentMessages);

  console.log('[ToolExecution] Continuation context compressed:', {
    compressedCount: compressedMessages.length,
  });

  return compressedMessages;
}

interface ToolExecutionHookProps {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsExecutingTool: React.Dispatch<React.SetStateAction<boolean>>;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  isStreamingRef: React.MutableRefObject<boolean>;
  isStoppingRef: React.MutableRefObject<boolean>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  sendingMessageRef: React.MutableRefObject<boolean>;
  updateToolExecution: (messageId: string, toolExecutionId: string, state: ToolExecutionState) => void;
  messagesRef: React.MutableRefObject<Message[]>;
  currentTodos?: Array<{ id: string; content: string; status: string }>;
  saveSession: () => void;
  mode: ChatMode;
}

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

  // Recreate tool executor when mode changes to refresh enabled tools
  useEffect(() => {
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
      bufferedToolResults?: string[], // Pre-computed results from incremental execution
    ) => {
      if (!toolExecutorRef.current) { return; }

      // Check if user stopped before starting continuation
      if (isStoppingRef.current) {
        console.log('[ToolExecution] User stopped, aborting executeToolAndContinue');
        setIsExecutingTool(false);
        return;
      }

      // If no userAttachments provided, try to find from the latest user message in history
      // This ensures images are preserved across tool execution continuations
      const effectiveUserAttachments = userAttachments ?? (() => {
        const lastUserMsg = [...messagesRef.current].reverse().find(m => m.role === 'user');
        return lastUserMsg?.attachments;
      })();

      try {
        console.log(`[ToolExecution] executeToolAndContinue called with toolIndex=${toolIndex}`);
        console.log(`[ToolExecution] assistantContent length: ${assistantContent.length}`);
        
        // If we have buffered results from incremental execution, skip to continuation
        if (bufferedToolResults && bufferedToolResults.length > 0) {
          console.log(`[ToolExecution] Using ${bufferedToolResults.length} buffered tool results from incremental execution`);
          
          const toolResultText = bufferedToolResults.join('\n\n');
          const diagnosticsText = ''; // Diagnostics already handled during incremental execution
          
          // Build continuation history for chat
          const latestWorkspace = (window.workspaceContext || workspace)!;
          const contextMessages = await buildCompressedContextIfNeeded(
            latestWorkspace,
            messagesRef.current,
            toolResultText,
            diagnosticsText,
            mode,
          );

          const continuationHistory = buildContinuationHistory(
            latestWorkspace,
            contextMessages,
            userContent,
            assistantContent,
            toolResultText,
            diagnosticsText,
            currentTodos,
            mode,
            effectiveUserAttachments
          );

          // Continue streaming with buffered results
          setIsExecutingTool(false);
          
          let continuationContent = assistantContent;
          let pendingUpdate = false;

          const updateUI = () => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: continuationContent }
                  : msg
              )
            );
            pendingUpdate = false;
          };

          // Start continuation stream
          const newAbortController = new AbortController();
          abortControllerRef.current = newAbortController;

          for await (const chunk of chatApi.streamChat(
            continuationHistory,
            newAbortController.signal
          )) {
            if (newAbortController.signal.aborted || isStoppingRef.current) {
              console.log('[ToolExecution] Continuation stream aborted');
              break;
            }

            continuationContent += chunk;

            // Check for another tool block in the new content only
            const newContent = continuationContent.slice(assistantContent.length);
            if (hasCompleteToolBlock(newContent)) {
              const trimmedContinuation = assistantContent + trimToFirstCompleteToolBlock(newContent);
              continuationContent = trimmedContinuation;
              updateUI();

              // Abort and execute next tool
              newAbortController.abort();
              setIsExecutingTool(true);
              await executeToolAndContinue(
                continuationContent,
                assistantMessageId,
                continuationHistory,
                messagesToSend,
                userContent,
                toolIndex + bufferedToolResults.length,
                effectiveUserAttachments
              );
              return;
            }

            if (!pendingUpdate) {
              pendingUpdate = true;
              requestAnimationFrame(updateUI);
            }
          }

          // Final update
          updateUI();
          return;
        }
        
        // Keep executing tool state active
        setIsExecutingTool(true);

        // Extract all tool blocks and get the current one by index
        const toolBlocks = extractToolBlocks(assistantContent);
        console.log(`[ToolExecution] extractToolBlocks returned ${toolBlocks.length} blocks`);
        const toolBlock = toolBlocks[toolIndex];

        if (!toolBlock) {
          setIsExecutingTool(false);
          return;
        }

        // Check if we can execute multiple tools in parallel
        // Pass the current toolIndex to find the function_calls block at that position
        const parallelizableBlocks = extractParallelizableToolBlocks(assistantContent, toolIndex);
        const canExecuteInParallel = parallelizableBlocks.length > 1;

        console.log(`[ToolExecution] toolIndex=${toolIndex}, toolBlocks.length=${toolBlocks.length}, parallelizableBlocks.length=${parallelizableBlocks.length}, canExecuteInParallel=${canExecuteInParallel}`);
        if (parallelizableBlocks.length > 0) {
          console.log(`[ToolExecution] Parallelizable tools:`, parallelizableBlocks.map(b => b.toolName));
        }

        if (canExecuteInParallel) {
          console.log(`[ToolExecution] Detected ${parallelizableBlocks.length} parallelizable tools, executing in parallel...`);
          console.log(`[ToolExecution] parallelizableBlocks:`, parallelizableBlocks.map(b => b.toolName));

          // Create execution states for all parallel tools
          // Use toolIndex + idx to match the global tool indexing from the tokenizer
          const executionStates = parallelizableBlocks.map((block, idx) => {
            const globalIdx = toolIndex + idx;
            const execId = generateToolExecutionId(assistantMessageId, globalIdx);
            console.log(`[ToolExecution] Creating parallel execution state: idx=${idx}, globalIdx=${globalIdx}, execId=${execId}, toolName=${block.toolName}`);
            const state = createToolExecutionState(
              execId,
              block.toolName,
              block.parameters
            );
            updateToolExecution(assistantMessageId, execId, state);
            return { block, state, execId };
          });

          // Check if stopped before execution
          if (isStoppingRef.current) {
            executionStates.forEach(({ state, execId }) => {
              const abortedState = updateToolExecutionStatus(state, 'aborted', {
                success: false,
                error: 'Stopped by user'
              });
              updateToolExecution(assistantMessageId, execId, abortedState);
            });
            setIsExecutingTool(false);
            return;
          }

          // Create a new AbortController for tool execution
          // This is needed because the stream was aborted to execute the tool
          const toolAbortController = new AbortController();
          abortControllerRef.current = toolAbortController;

          // Execute all tools in parallel using the tool executor
          const parallelResult = await toolExecutorRef.current.executeToolBlocksInParallel(parallelizableBlocks);

          if (parallelResult.wasStopped) {
            executionStates.forEach(({ state, execId }) => {
              const abortedState = updateToolExecutionStatus(state, 'aborted', {
                success: false,
                error: 'Stopped by user'
              });
              updateToolExecution(assistantMessageId, execId, abortedState);
            });
            setIsExecutingTool(false);
            return;
          }

          // Update all tool execution states with results
          console.log(`[ToolExecution] Parallel execution complete. executedToolCalls:`, parallelResult.executedToolCalls.length);
          const completedStates = parallelResult.executedToolCalls.map((executedTool, idx) => {
            const { state, execId } = executionStates[idx];
            console.log(`[ToolExecution] Updating parallel result: idx=${idx}, execId=${execId}, toolName=${executedTool.toolName}, status=${executedTool.status}`);
            const completedState = updateToolExecutionStatus(
              state,
              executedTool.status,
              executedTool.result
            );
            updateToolExecution(assistantMessageId, execId, completedState);
            return { toolName: executedTool.toolName, result: executedTool.result, state: completedState };
          });

          // Extract diagnostics from tool results (Roo Code approach - no external fetch needed)
          const diagnosticsTexts = getDiagnosticsFromToolResultsParallel(
            completedStates,
            diagnosticAttemptsRef
          );

          // Check if stopped during diagnostic fetching
          if (isStoppingRef.current) {
            console.log('[Tool] User stopped during diagnostic fetching, aborting continuation');
            setIsExecutingTool(false);
            return;
          }

          // Format tool results for AI context
          const toolResultText = parallelResult.toolResults.join('\n\n');
          const diagnosticsText = diagnosticsTexts.join('\n\n');

          // Build continuation history for chat, with optional compression
          const latestWorkspace = (window.workspaceContext || workspace)!;
          const contextMessages = await buildCompressedContextIfNeeded(
            latestWorkspace,
            messagesRef.current,
            toolResultText,
            diagnosticsText,
            mode,
          );

          const continuationHistory = buildContinuationHistory(
            latestWorkspace,
            contextMessages,
            userContent,
            assistantContent,
            toolResultText,
            diagnosticsText,
            currentTodos,
            mode,
            effectiveUserAttachments
          );

          // Continue streaming with results from parallel execution
          setIsExecutingTool(false);

          let continuationContent = assistantContent;
          let pendingUpdate = false;

          const updateUI = () => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: continuationContent }
                  : msg
              )
            );
            pendingUpdate = false;
          };

          // Auto-retry logic for HTTP errors - keeps trying until success or user abort
          let retryCount = 0;
          let streamSuccess = false;

          while (!streamSuccess) {
            try {
              const newAbortController = new AbortController();
              abortControllerRef.current = newAbortController;

              // Reset continuation content on retry (keep original assistant content)
              if (retryCount > 0) {
                console.log(`[Tool] Retry attempt ${retryCount} for parallel continuation stream...`);
                continuationContent = assistantContent;
              }

              for await (const chunk of chatApi.streamChat(
                continuationHistory,
                newAbortController.signal
              )) {
                if (newAbortController.signal.aborted) {
                  streamSuccess = true; // User aborted, don't retry
                  break;
                }

                continuationContent += chunk;

                // Check for another tool block in the new content only
                const newContent = continuationContent.slice(assistantContent.length);
                if (hasCompleteToolBlock(newContent)) {
                  const trimmedContinuation = assistantContent + trimToFirstCompleteToolBlock(newContent);
                  continuationContent = trimmedContinuation;

                  if (pendingUpdate) {
                    updateUI();
                  } else {
                    updateUI();
                  }

                  // Abort and execute next tool (starting from the index after parallel batch)
                  newAbortController.abort();
                  setIsExecutingTool(true);
                  await executeToolAndContinue(
                    continuationContent,
                    assistantMessageId,
                    continuationHistory,
                    messagesToSend,
                    userContent,
                    toolIndex + parallelizableBlocks.length, // Continue from after the parallel batch
                    effectiveUserAttachments
                  );
                  return;
                }

                if (!pendingUpdate) {
                  pendingUpdate = true;
                  requestAnimationFrame(updateUI);
                }
              }

              // Stream completed successfully
              streamSuccess = true;

              // Final update - always update to ensure continuation text is displayed
              updateUI();
            } catch (streamError) {
              const errorMessage = streamError instanceof Error ? streamError.message : 'Unknown error';
              const lowerError = errorMessage.toLowerCase();

              // Detect retryable transient errors:
              // - HTTP errors (500, 502, 503, 504)
              // - JSON parse errors (server returned malformed response)
              // - Service unavailable
              // - Connection errors
              const isRetryableError =
                lowerError.includes('http') ||
                lowerError.includes('500') ||
                lowerError.includes('502') ||
                lowerError.includes('503') ||
                lowerError.includes('504') ||
                lowerError.includes('parse') ||
                lowerError.includes('json') ||
                lowerError.includes('service unavailable') ||
                lowerError.includes('econnreset') ||
                lowerError.includes('etimedout') ||
                lowerError.includes('econnrefused') ||
                lowerError.includes('network') ||
                lowerError.includes('fetch');

              // Check if user manually aborted
              if (abortControllerRef.current?.signal.aborted || isStoppingRef.current) {
                console.log('[Tool] User aborted, stopping retries');
                streamSuccess = true;
              } else if (isRetryableError) {
                retryCount++;
                console.warn(`[Tool] Transient error during parallel continuation, auto-retrying (attempt ${retryCount}):`, errorMessage);
                // Brief delay before retry (exponential backoff capped at 5s)
                await new Promise(resolve => setTimeout(resolve, Math.min(1000 * retryCount, 5000)));
              } else {
                // Non-retryable error, rethrow
                throw streamError;
              }
            }
          }

          return; // Exit after parallel execution
        }

        // Single tool execution path (existing logic)
        // Generate tool execution ID with correct index
        const toolExecutionId = generateToolExecutionId(assistantMessageId, toolIndex);

        // Create initial execution state (executing immediately)
        const executionState = createToolExecutionState(
          toolExecutionId,
          toolBlock.toolName,
          toolBlock.parameters
        );

        // Update UI with executing status
        updateToolExecution(assistantMessageId, toolExecutionId, executionState);

        // Check if stopped before execution
        if (isStoppingRef.current) {
          const abortedState = updateToolExecutionStatus(executionState, 'aborted', {
            success: false,
            error: 'Stopped by user'
          });
          updateToolExecution(assistantMessageId, toolExecutionId, abortedState);
          setIsExecutingTool(false);
          return;
        }

        // Create a new AbortController for tool execution
        // This is needed because the stream was aborted to execute the tool
        const toolAbortController = new AbortController();
        abortControllerRef.current = toolAbortController;

        // Create progress callback for echo_search iterations
        const onProgress: ToolProgressCallback = (progress) => {
          const updatedState = updateToolExecutionProgress(executionState, progress);
          updateToolExecution(assistantMessageId, toolExecutionId, updatedState);
        };

        // Execute the specific tool directly
        const result = await executeToolWithStopCheck(
          toolExecutorRef.current,
          toolBlock,
          isStoppingRef,
          toolBlock.toolName === 'echo_search' ? onProgress : undefined,
          toolAbortController.signal
        );

        if (result.wasStopped) {
          // Update to aborted status
          const abortedState = updateToolExecutionStatus(executionState, 'aborted', {
            success: false,
            error: 'Stopped by user'
          });
          updateToolExecution(assistantMessageId, toolExecutionId, abortedState);
          setIsExecutingTool(false);
          return;
        }

        if (result.executedToolCalls.length === 0) {
          setIsExecutingTool(false);
          return;
        }

        // Get the execution result from tool executor
        const executedTool = result.executedToolCalls[0];
        let completedState = executionState;
        if (executedTool) {
          // Update tool execution state with result - show in dropdown immediately
          completedState = updateToolExecutionStatus(
            executionState,
            executedTool.status,
            executedTool.result
          );
          updateToolExecution(assistantMessageId, toolExecutionId, completedState);
        }

        // Check if this is a planning tool that requires user interaction
        const isPlanningTool = toolBlock.toolName === 'plan_navigator' || toolBlock.toolName === 'plan_handoff';

        if (isPlanningTool) {
          // Stop execution here - wait for user to interact with the tool
          setIsExecutingTool(false);
          return;
        }

        // Format tool results for AI context
        const toolResultText = result.toolResults.join('\n\n');


        // Extract diagnostics from tool result (Roo Code approach - no external fetch needed)
        // Only file modification tools (write_to_file, apply_diff) include diagnostics
        const diagnosticsText = getDiagnosticsFromToolResult(executedTool, diagnosticAttemptsRef);

        // Check if stopped during diagnostic fetching
        if (isStoppingRef.current) {
          console.log('[Tool] User stopped during diagnostic fetching, aborting continuation');
          setIsExecutingTool(false);
          return;
        }

        // Build continuation history for chat, with optional compression
        const latestWorkspace = (window.workspaceContext || workspace)!;
        const contextMessages = await buildCompressedContextIfNeeded(
          latestWorkspace,
          messagesRef.current,
          toolResultText,
          diagnosticsText,
          mode,
        );

        const continuationHistory = buildContinuationHistory(
          latestWorkspace,
          contextMessages,
          userContent,
          assistantContent,
          toolResultText,
          diagnosticsText,
          currentTodos,
          mode,
          effectiveUserAttachments
        );

        // Continue streaming - clear executing tool state
        setIsExecutingTool(false);

        let continuationContent = assistantContent;
        let pendingUpdate = false;

        const updateUI = () => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: continuationContent }
                : msg
            )
          );
          pendingUpdate = false;
        };

        // Auto-retry logic for HTTP errors - keeps trying until success or user abort
        let retryCount = 0;
        let streamSuccess = false;

        while (!streamSuccess && !isStoppingRef.current) {
          try {
            const newAbortController = new AbortController();
            abortControllerRef.current = newAbortController;

            // Reset continuation content on retry (keep original assistant content)
            if (retryCount > 0) {
              console.log(`[Tool] Retry attempt ${retryCount} for continuation stream...`);
              continuationContent = assistantContent;
            }

            console.log('[ToolExecution] Starting continuation stream...');
            let chunkCount = 0;
            for await (const chunk of chatApi.streamChat(
              continuationHistory,
              newAbortController.signal
            )) {
              chunkCount++;
              if (chunkCount <= 3) {
                console.log(`[ToolExecution] Continuation chunk #${chunkCount}:`, chunk.substring(0, 50));
              }
              if (newAbortController.signal.aborted || isStoppingRef.current) {
                console.log('[ToolExecution] Continuation stream aborted');
                streamSuccess = true; // User aborted, don't retry
                break;
              }

              continuationContent += chunk;

              // Check for another tool block in the new content only
              const newContent = continuationContent.slice(assistantContent.length);
              if (hasCompleteToolBlock(newContent)) {
                // Trim the entire continuation content to only include up to the first complete tool block
                // This ensures we execute tools strictly one-by-one
                const trimmedContinuation = assistantContent + trimToFirstCompleteToolBlock(newContent);
                continuationContent = trimmedContinuation;

                // Update UI with trimmed content before interrupting
                if (pendingUpdate) {
                  updateUI();
                } else {
                  updateUI();
                }

                // Abort and execute next tool
                newAbortController.abort();
                setIsExecutingTool(true);
                await executeToolAndContinue(
                  continuationContent,
                  assistantMessageId,
                  continuationHistory,
                  messagesToSend,
                  userContent,
                  toolIndex + 1,
                  effectiveUserAttachments
                );
                return;
              }

              if (!pendingUpdate) {
                pendingUpdate = true;
                requestAnimationFrame(updateUI);
              }
            }

            // Stream completed successfully
            streamSuccess = true;
            console.log(`[ToolExecution] Continuation stream completed, ${chunkCount} chunks received`);
            console.log(`[ToolExecution] Final continuation content length: ${continuationContent.length}`);

            // Final update - always update to ensure continuation text is displayed
            updateUI();
          } catch (streamError) {
            const errorMessage = streamError instanceof Error ? streamError.message : 'Unknown error';
            const lowerError = errorMessage.toLowerCase();

            // Detect retryable transient errors:
            // - HTTP errors (500, 502, 503, 504)
            // - JSON parse errors (server returned malformed response)
            // - Service unavailable
            // - Connection errors
            const isRetryableError =
              lowerError.includes('http') ||
              lowerError.includes('500') ||
              lowerError.includes('502') ||
              lowerError.includes('503') ||
              lowerError.includes('504') ||
              lowerError.includes('parse') ||
              lowerError.includes('json') ||
              lowerError.includes('service unavailable') ||
              lowerError.includes('econnreset') ||
              lowerError.includes('etimedout') ||
              lowerError.includes('econnrefused') ||
              lowerError.includes('network') ||
              lowerError.includes('fetch');

            // Check if user manually aborted
            if (abortControllerRef.current?.signal.aborted || isStoppingRef.current) {
              console.log('[Tool] User aborted, stopping retries');
              streamSuccess = true;
            } else if (isRetryableError) {
              retryCount++;
              console.warn(`[Tool] Transient error during continuation, auto-retrying (attempt ${retryCount}):`, errorMessage);
              // Brief delay before retry (exponential backoff capped at 5s)
              await new Promise(resolve => setTimeout(resolve, Math.min(1000 * retryCount, 5000)));
            } else {
              // Non-retryable error, rethrow
              throw streamError;
            }
          }
        }
      } catch (error) {
        console.error('[Tool] Execution error:', error);

        // Try to extract tool info for error state update
        // But ONLY if the tool hasn't already completed successfully
        // (e.g., don't overwrite successful tool state with continuation stream errors)
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
            console.warn('[Tool] Continuation stream error after successful tool execution:', error);
          }
        }
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
    [workspace, updateToolExecution, setMessages, setIsExecutingTool, setIsStreaming, isStreamingRef, isStoppingRef, abortControllerRef, sendingMessageRef, currentTodos, messagesRef, saveSession, mode],
  );

  return { executeToolAndContinue };
}
