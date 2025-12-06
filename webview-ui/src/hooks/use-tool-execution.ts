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
import { fetchDiagnostics, formatDiagnosticsForAI, shouldFetchDiagnostics, isFileModificationTool as checkIsFileModificationTool } from '../utils/diagnostic-utils';
import { buildContinuationHistory } from '../utils/continuation-builder';
import { executeToolWithStopCheck, type ToolProgressCallback } from '../utils/tool-execution-helpers';
import { getContextCompressor } from '../services/context-compressor';
import { storageService } from '../utils/storage';
import { getSystemPrompt } from '../utils/prompts';

/**
 * Helper to fetch and format diagnostics for a tool execution
 */
async function fetchAndFormatDiagnostics(
  executedTool: { toolName: string; result?: { success: boolean; data?: unknown } } | undefined,
  completedState: ToolExecutionState,
  assistantMessageId: string,
  toolExecutionId: string,
  updateToolExecution: (messageId: string, toolExecutionId: string, state: ToolExecutionState) => void,
  diagnosticAttemptsRef: React.MutableRefObject<Record<string, number>>
): Promise<string> {
  if (!executedTool?.result?.success || !('data' in executedTool.result) || !executedTool.result.data) {
    return '';
  }

  const data = executedTool.result.data as Record<string, unknown>;
  const filePath = (data.path as string) || 'unknown';
  const absolutePath = data.absolutePath as string;

  // Get parameters from the completed state for check_lints support
  const toolParameters = completedState.parameters;

  if (!shouldFetchDiagnostics(executedTool.toolName, toolParameters) || !absolutePath) {
    return '';
  }

  // Update status to fetching_diagnostics
  const fetchingState = { ...completedState, status: 'fetching_diagnostics' as const };
  updateToolExecution(assistantMessageId, toolExecutionId, fetchingState);

  console.log(`[ToolExecution] Fetching diagnostics for ${filePath}...`);

  // Fetch diagnostics from backend
  const diagnostics = await fetchDiagnostics(filePath, absolutePath);

  // Update state with diagnostics
  const finalState = { ...completedState, diagnostics };
  updateToolExecution(assistantMessageId, toolExecutionId, finalState);

  // Handle diagnostic results
  if (diagnostics && diagnostics.length > 0) {
    const isModificationTool = checkIsFileModificationTool(executedTool.toolName);
    const maxIterations = 3;

    if (isModificationTool) {
      const currentAttempts = (diagnosticAttemptsRef.current[filePath] || 0) + 1;
      diagnosticAttemptsRef.current[filePath] = currentAttempts;
      return formatDiagnosticsForAI(diagnostics, filePath, isModificationTool, currentAttempts, maxIterations);
    }

    return formatDiagnosticsForAI(diagnostics, filePath, isModificationTool, 0, maxIterations);
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
 * Fetch diagnostics for multiple files in parallel
 */
async function fetchAndFormatDiagnosticsParallel(
  executedTools: Array<{ toolName: string; result?: { success: boolean; data?: unknown }; state: ToolExecutionState }>,
  assistantMessageId: string,
  updateToolExecution: (messageId: string, toolExecutionId: string, state: ToolExecutionState) => void,
  diagnosticAttemptsRef: React.MutableRefObject<Record<string, number>>
): Promise<string[]> {
  console.log(`[ToolExecution] Fetching diagnostics for ${executedTools.length} files in parallel...`);

  const diagnosticsPromises = executedTools.map(async ({ toolName, result, state }) => {
    if (!result?.success || !('data' in result) || !result.data) {
      return '';
    }

    const data = result.data as Record<string, unknown>;
    const filePath = (data.path as string) || 'unknown';
    const absolutePath = data.absolutePath as string;

    // Get parameters from the state for check_lints support
    const toolParameters = state.parameters;

    if (!shouldFetchDiagnostics(toolName, toolParameters) || !absolutePath) {
      return '';
    }

    // Update status to fetching_diagnostics
    const fetchingState = { ...state, status: 'fetching_diagnostics' as const };
    updateToolExecution(assistantMessageId, state.toolExecutionId, fetchingState);

    // Fetch diagnostics from backend
    const diagnostics = await fetchDiagnostics(filePath, absolutePath);

    // Update state with diagnostics
    const finalState = { ...state, diagnostics };
    updateToolExecution(assistantMessageId, state.toolExecutionId, finalState);

    // Handle diagnostic results
    if (diagnostics && diagnostics.length > 0) {
      const isModificationTool = checkIsFileModificationTool(toolName);
      const maxIterations = 3;

      if (isModificationTool) {
        const currentAttempts = (diagnosticAttemptsRef.current[filePath] || 0) + 1;
        diagnosticAttemptsRef.current[filePath] = currentAttempts;
        return formatDiagnosticsForAI(diagnostics, filePath, isModificationTool, currentAttempts, maxIterations);
      }

      return formatDiagnosticsForAI(diagnostics, filePath, isModificationTool, 0, maxIterations);
    } else {
      // No diagnostics found - reset attempts counter
      if (diagnosticAttemptsRef.current[filePath]) {
        console.log(`[Diagnostics] No errors found for ${filePath} - resetting attempt counter`);
        delete diagnosticAttemptsRef.current[filePath];
      }
      return '';
    }
  });

  const results = await Promise.all(diagnosticsPromises);
  console.log(`[ToolExecution] Completed parallel diagnostics fetch for ${executedTools.length} files`);
  return results.filter(r => r.length > 0);
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
    ) => {
      if (!toolExecutorRef.current) { return; }

      // If no userAttachments provided, try to find from the latest user message in history
      // This ensures images are preserved across tool execution continuations
      const effectiveUserAttachments = userAttachments ?? (() => {
        const lastUserMsg = [...messagesRef.current].reverse().find(m => m.role === 'user');
        return lastUserMsg?.attachments;
      })();

      try {
        // Keep executing tool state active
        setIsExecutingTool(true);

        // Extract all tool blocks and get the current one by index
        const toolBlocks = extractToolBlocks(assistantContent);
        const toolBlock = toolBlocks[toolIndex];

        if (!toolBlock) {
          setIsExecutingTool(false);
          return;
        }

        // Check if we can execute multiple tools in parallel
        // Only execute in parallel if we're at the first tool and there are consecutive parallelizable tools
        const shouldExecuteInParallel = toolIndex === 0;
        const parallelizableBlocks = shouldExecuteInParallel ? extractParallelizableToolBlocks(assistantContent) : [];
        const canExecuteInParallel = parallelizableBlocks.length > 1;

        if (canExecuteInParallel) {
          console.log(`[ToolExecution] Detected ${parallelizableBlocks.length} parallelizable tools, executing in parallel...`);

          // Create execution states for all parallel tools
          const executionStates = parallelizableBlocks.map((block, idx) => {
            const execId = generateToolExecutionId(assistantMessageId, idx);
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
          const completedStates = parallelResult.executedToolCalls.map((executedTool, idx) => {
            const { state, execId } = executionStates[idx];
            const completedState = updateToolExecutionStatus(
              state,
              executedTool.status,
              executedTool.result
            );
            updateToolExecution(assistantMessageId, execId, completedState);
            return { toolName: executedTool.toolName, result: executedTool.result, state: completedState };
          });

          // Fetch diagnostics in parallel for all modified files
          const diagnosticsTexts = await fetchAndFormatDiagnosticsParallel(
            completedStates,
            assistantMessageId,
            updateToolExecution,
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
                    parallelizableBlocks.length, // Continue from after the parallel batch
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

              // Final update
              if (pendingUpdate) {
                updateUI();
              }
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
          toolBlock.toolName === 'echo_search' ? onProgress : undefined
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

        // Fetch diagnostics after showing result
        // Check if this is a multi-file read_file result
        let diagnosticsText = '';
        if (executedTool?.toolName === 'read_file' && executedTool.result?.success && executedTool.result.data) {
          const resultData = executedTool.result.data as Record<string, unknown>;
          if ('files' in resultData && Array.isArray(resultData.files) && resultData.files.length > 1) {
            // Multi-file result - create separate tool execution states for each file
            const files = resultData.files as Array<{ path: string; absolutePath?: string; content: string; startLine?: number; endLine?: number; totalLines?: number }>;

            // Create tool execution entries for each file so they can show "Linting" status
            files.forEach((file, fileIdx) => {
              const fileToolExecutionId = `${toolExecutionId}-file-${fileIdx}`;
              const fileState: ToolExecutionState = {
                toolExecutionId: fileToolExecutionId,
                toolName: 'read_file',
                parameters: { path: file.path },
                status: 'completed',
                result: {
                  success: true,
                  data: file
                },
                startedAt: completedState.startedAt,
                completedAt: completedState.completedAt,
              };
              updateToolExecution(assistantMessageId, fileToolExecutionId, fileState);
            });

            // Now fetch diagnostics for all files in parallel
            const diagnosticsPromises = files.map(async (file, fileIdx) => {
              const fileToolExecutionId = `${toolExecutionId}-file-${fileIdx}`;
              const fileData = { path: file.path, absolutePath: file.absolutePath };
              const fileState: ToolExecutionState = {
                toolExecutionId: fileToolExecutionId,
                toolName: 'read_file',
                parameters: { path: file.path },
                status: 'completed',
                result: {
                  success: true,
                  data: file
                },
                startedAt: completedState.startedAt,
                completedAt: completedState.completedAt,
              };

              return fetchAndFormatDiagnostics(
                { toolName: 'read_file', result: { success: true, data: fileData } },
                fileState,
                assistantMessageId,
                fileToolExecutionId,
                updateToolExecution,
                diagnosticAttemptsRef
              );
            });
            const diagnosticsResults = await Promise.all(diagnosticsPromises);
            diagnosticsText = diagnosticsResults.filter(d => d.length > 0).join('\n\n');
          } else {
            // Single file result - use normal diagnostics fetch
            diagnosticsText = await fetchAndFormatDiagnostics(
              executedTool,
              completedState,
              assistantMessageId,
              toolExecutionId,
              updateToolExecution,
              diagnosticAttemptsRef
            );
          }
        } else {
          // Not read_file or other tool - use normal diagnostics fetch
          diagnosticsText = await fetchAndFormatDiagnostics(
            executedTool,
            completedState,
            assistantMessageId,
            toolExecutionId,
            updateToolExecution,
            diagnosticAttemptsRef
          );
        }

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

        while (!streamSuccess) {
          try {
            const newAbortController = new AbortController();
            abortControllerRef.current = newAbortController;

            // Reset continuation content on retry (keep original assistant content)
            if (retryCount > 0) {
              console.log(`[Tool] Retry attempt ${retryCount} for continuation stream...`);
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

            // Final update
            if (pendingUpdate) {
              updateUI();
            }
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
