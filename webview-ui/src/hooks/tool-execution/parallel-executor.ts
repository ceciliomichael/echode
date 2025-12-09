/**
 * Parallel Executor Module
 * 
 * Handles execution of multiple tools in parallel within a single function_calls block.
 * Manages execution states, result aggregation, and diagnostics for parallel tools.
 */
import type { Message, ImageAttachment } from '../../types/chat';
import type { ToolExecutionState } from '../../types/tool';
import type { ToolBlock, ToolExecutionContext, ExecuteToolAndContinueFn } from './types';
import { ToolExecutor } from '../../lib/tool-executor';
import { createToolExecutionState, updateToolExecutionStatus, generateToolExecutionId } from '../../lib/tool-execution-tracker';
import { buildContinuationHistory } from '../../utils/continuation-builder';
import { getDiagnosticsFromToolResultsParallel } from './diagnostics-handler';
import { buildCompressedContextIfNeeded } from './context-compression';
import { runContinuationStream } from './continuation-stream';

/**
 * Parameters for parallel tool execution
 */
export interface ParallelExecutionParams {
  parallelizableBlocks: ToolBlock[];
  assistantContent: string;
  assistantMessageId: string;
  toolIndex: number;
  messagesToSend: Message[];
  userContent: string;
  userAttachments?: ImageAttachment[];
  toolExecutor: ToolExecutor;
  context: ToolExecutionContext;
  executeToolAndContinue: ExecuteToolAndContinueFn;
}

/**
 * Result from parallel execution
 */
export interface ParallelExecutionResult {
  wasStopped: boolean;
  continueExecution: boolean;
}

/**
 * Execute multiple tools in parallel and handle continuation
 */
export async function executeToolsInParallel(
  params: ParallelExecutionParams
): Promise<ParallelExecutionResult> {
  const {
    parallelizableBlocks,
    assistantContent,
    assistantMessageId,
    toolIndex,
    messagesToSend,
    userContent,
    userAttachments,
    toolExecutor,
    context,
    executeToolAndContinue,
  } = params;

  const {
    isStoppingRef,
    abortControllerRef,
    setIsExecutingTool,
    updateToolExecution,
    messagesRef,
    currentTodos,
    mode,
    diagnosticAttemptsRef,
    workspace,
  } = context;

  console.log(`[ParallelExecutor] Executing ${parallelizableBlocks.length} tools in parallel...`);
  console.log(`[ParallelExecutor] Tools:`, parallelizableBlocks.map(b => b.toolName));

  // Create execution states for all parallel tools
  const executionStates = parallelizableBlocks.map((block, idx) => {
    const globalIdx = toolIndex + idx;
    const execId = generateToolExecutionId(assistantMessageId, globalIdx);
    console.log(`[ParallelExecutor] Creating execution state: idx=${idx}, globalIdx=${globalIdx}, execId=${execId}, toolName=${block.toolName}`);
    
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
    markAllAsAborted(executionStates, assistantMessageId, updateToolExecution);
    setIsExecutingTool(false);
    return { wasStopped: true, continueExecution: false };
  }

  // Create a new AbortController for tool execution
  const toolAbortController = new AbortController();
  abortControllerRef.current = toolAbortController;

  // Execute all tools in parallel, but update each tool's execution state
  // as soon as its individual execution completes. This ensures tools like
  // apply_diff and write_to_file surface their results incrementally instead
  // of waiting for the entire parallel batch to finish.
  const executionPromises = executionStates.map(({ block, state, execId }, idx) => {
    return (async () => {
      try {
        // Short-circuit if user requested stop before this tool actually runs
        if (isStoppingRef.current) {
          const abortedState = updateToolExecutionStatus(state, 'aborted', {
            success: false,
            error: 'Stopped by user',
          });
          updateToolExecution(assistantMessageId, execId, abortedState);
          return {
            toolName: block.toolName,
            result: abortedState.result!,
            state: abortedState,
            formattedText: `Tool: ${block.toolName}\nStatus: aborted`,
          };
        }

        console.log(
          `[ParallelExecutor] Starting execution: idx=${idx}, execId=${execId}, toolName=${block.toolName}`,
        );

        const result = await toolExecutor.execute(
          {
            toolName: block.toolName,
            parameters: block.parameters,
            status: 'executing',
          },
          undefined,
          undefined,
        );

        // If the user stopped while this tool was running, treat it as aborted
        if (isStoppingRef.current) {
          const abortedState = updateToolExecutionStatus(state, 'aborted', {
            success: false,
            error: 'Stopped by user',
          });
          updateToolExecution(assistantMessageId, execId, abortedState);
          return {
            toolName: block.toolName,
            result: abortedState.result!,
            state: abortedState,
            formattedText: `Tool: ${block.toolName}\nStatus: aborted`,
          };
        }

        const status = result.success ? 'completed' as const : 'error' as const;
        const completedState = updateToolExecutionStatus(state, status, result);
        updateToolExecution(assistantMessageId, execId, completedState);

        console.log(
          `[ParallelExecutor] Completed execution: idx=${idx}, execId=${execId}, toolName=${block.toolName}, status=${status}`,
        );

        // Format result text for AI context
        let formattedText: string;
        if (result.success && 'data' in result && result.data !== undefined) {
          formattedText = `Tool: ${block.toolName}\nResult: ${JSON.stringify(result.data, null, 2)}`;
        } else if (result.error) {
          formattedText = `Tool: ${block.toolName}\nError: ${result.error}`;
        } else {
          formattedText = `Tool: ${block.toolName}\nStatus: ${status}`;
        }

        return {
          toolName: block.toolName,
          result,
          state: completedState,
          formattedText,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const errorResult = {
          success: false as const,
          error: message,
        };

        const errorState = updateToolExecutionStatus(state, 'error', errorResult);
        updateToolExecution(assistantMessageId, execId, errorState);

        console.error(
          `[ParallelExecutor] Tool error: idx=${idx}, execId=${execId}, toolName=${block.toolName}, error=${message}`,
        );

        return {
          toolName: block.toolName,
          result: errorResult,
          state: errorState,
          formattedText: `Tool: ${block.toolName}\nError: ${message}`,
        };
      }
    })();
  });

  const parallelResults = await Promise.all(executionPromises);

  // If user stopped while tools were executing, respect the stop signal
  if (isStoppingRef.current) {
    console.log('[ParallelExecutor] User stopped during parallel tool execution');
    setIsExecutingTool(false);
    return { wasStopped: true, continueExecution: false };
  }

  // Map to the completed state structure expected by diagnostics handler
  const completedStates = parallelResults.map(result => ({
    toolName: result.toolName,
    result: result.result,
    state: result.state,
  }));

  // Extract diagnostics from tool results
  const diagnosticsTexts = getDiagnosticsFromToolResultsParallel(
    completedStates,
    diagnosticAttemptsRef
  );

  // Check if stopped during diagnostic processing
  if (isStoppingRef.current) {
    console.log('[ParallelExecutor] User stopped during diagnostic processing');
    setIsExecutingTool(false);
    return { wasStopped: true, continueExecution: false };
  }

  // Format tool results for AI context
  const toolResultText = parallelResults.map(result => result.formattedText).join('\n\n');
  const diagnosticsText = diagnosticsTexts.join('\n\n');

  // Build continuation history with optional compression
  const latestWorkspace = (window.workspaceContext || workspace)!;
  const contextMessages = await buildCompressedContextIfNeeded(
    latestWorkspace,
    messagesRef.current,
    toolResultText,
    diagnosticsText,
    mode
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
    userAttachments
  );

  // Continue streaming with results
  setIsExecutingTool(false);

  await runContinuationStream({
    continuationHistory,
    assistantContent,
    assistantMessageId,
    messagesToSend,
    userContent,
    nextToolIndex: toolIndex + parallelizableBlocks.length,
    userAttachments,
    abortControllerRef,
    isStoppingRef,
    setMessages: context.setMessages,
    setIsExecutingTool,
    executeToolAndContinue,
    logPrefix: '[ParallelExecutor]',
    mode,
  });

  return { wasStopped: false, continueExecution: true };
}

/**
 * Mark all execution states as aborted
 */
function markAllAsAborted(
  executionStates: Array<{ state: ToolExecutionState; execId: string }>,
  assistantMessageId: string,
  updateToolExecution: (messageId: string, toolExecutionId: string, state: ToolExecutionState) => void
): void {
  executionStates.forEach(({ state, execId }) => {
    const abortedState = updateToolExecutionStatus(state, 'aborted', {
      success: false,
      error: 'Stopped by user'
    });
    updateToolExecution(assistantMessageId, execId, abortedState);
  });
}