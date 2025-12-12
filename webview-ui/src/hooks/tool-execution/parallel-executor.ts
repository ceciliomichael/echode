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
import { runContinuationStream } from './continuation-stream';
import { areAllToolsParallelAllowed } from '../../lib/tool-parallel-config';

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

  // RUNTIME GUARD: Verify ALL tools are in the parallel allow-list
  // If any tool is not allowed, fall back to serial execution
  const toolNames = parallelizableBlocks.map(b => b.toolName);
  if (!areAllToolsParallelAllowed(toolNames)) {

    // Execute tools serially instead of in parallel
    return executeToolsSerially(params);
  }

  // Create execution states for all parallel tools
  const executionStates = parallelizableBlocks.map((block, idx) => {
    const globalIdx = toolIndex + idx;
    const execId = generateToolExecutionId(assistantMessageId, globalIdx);

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
    setIsExecutingTool(false);
    return { wasStopped: true, continueExecution: false };
  }

  // Format tool results for AI context
  const toolResultText = parallelResults.map(result => result.formattedText).join('\n\n');
  const diagnosticsText = diagnosticsTexts.join('\n\n');

  // Build continuation history
  const latestWorkspace = (window.workspaceContext || workspace)!;

  const continuationHistory = buildContinuationHistory(
    latestWorkspace,
    messagesRef.current,
    userContent,
    assistantContent,
    toolResultText,
    diagnosticsText,
    currentTodos,
    mode,
    userAttachments
  );

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

function markAllAsAborted(
  executionStates: Array<{ state: ToolExecutionState; execId: string }>,
  assistantMessageId: string,
  updateToolExecution: (messageId: string, toolExecutionId: string, state: ToolExecutionState) => void
): void {
  executionStates.forEach(({ state, execId }) => {
    const abortedState = updateToolExecutionStatus(state, 'aborted', { success: false, error: 'Stopped by user' });
    updateToolExecution(assistantMessageId, execId, abortedState);
  });
}

async function executeToolsSerially(params: ParallelExecutionParams): Promise<ParallelExecutionResult> {
  const { parallelizableBlocks, assistantContent, assistantMessageId, toolIndex, messagesToSend, userContent, userAttachments, toolExecutor, context, executeToolAndContinue } = params;
  const { isStoppingRef, abortControllerRef, setIsExecutingTool, updateToolExecution, messagesRef, currentTodos, mode, diagnosticAttemptsRef, workspace } = context;
  const allResults: Array<{ toolName: string; result: { success: boolean; error?: string; data?: unknown }; state: ToolExecutionState; formattedText: string }> = [];

  for (let idx = 0; idx < parallelizableBlocks.length; idx++) {
    const block = parallelizableBlocks[idx];
    const execId = generateToolExecutionId(assistantMessageId, toolIndex + idx);
    if (isStoppingRef.current) { setIsExecutingTool(false); return { wasStopped: true, continueExecution: false }; }

    const state = createToolExecutionState(execId, block.toolName, block.parameters);
    updateToolExecution(assistantMessageId, execId, state);
    abortControllerRef.current = new AbortController();

    try {
      const result = await toolExecutor.execute({ toolName: block.toolName, parameters: block.parameters, status: 'executing' }, undefined, undefined);
      if (isStoppingRef.current) { updateToolExecution(assistantMessageId, execId, updateToolExecutionStatus(state, 'aborted', { success: false, error: 'Stopped' })); setIsExecutingTool(false); return { wasStopped: true, continueExecution: false }; }
      const status = result.success ? 'completed' as const : 'error' as const;
      const completedState = updateToolExecutionStatus(state, status, result);
      updateToolExecution(assistantMessageId, execId, completedState);
      const formattedText = result.success && 'data' in result ? `Tool: ${block.toolName}\nResult: ${JSON.stringify(result.data, null, 2)}` : result.error ? `Tool: ${block.toolName}\nError: ${result.error}` : `Tool: ${block.toolName}\nStatus: ${status}`;
      allResults.push({ toolName: block.toolName, result, state: completedState, formattedText });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      const errorState = updateToolExecutionStatus(state, 'error', { success: false, error: msg });
      updateToolExecution(assistantMessageId, execId, errorState);
      allResults.push({ toolName: block.toolName, result: { success: false, error: msg }, state: errorState, formattedText: `Tool: ${block.toolName}\nError: ${msg}` });
    }
  }

  if (isStoppingRef.current) { setIsExecutingTool(false); return { wasStopped: true, continueExecution: false }; }

  const completedStates = allResults.map(r => ({ toolName: r.toolName, result: r.result, state: r.state }));
  const diagnosticsTexts = getDiagnosticsFromToolResultsParallel(completedStates, diagnosticAttemptsRef);
  const toolResultText = allResults.map(r => r.formattedText).join('\n\n');
  const diagnosticsText = diagnosticsTexts.join('\n\n');
  const latestWorkspace = (window.workspaceContext || workspace)!;
  const continuationHistory = buildContinuationHistory(latestWorkspace, messagesRef.current, userContent, assistantContent, toolResultText, diagnosticsText, currentTodos, mode, userAttachments);

  setIsExecutingTool(false);
  await runContinuationStream({ continuationHistory, assistantContent, assistantMessageId, messagesToSend, userContent, nextToolIndex: toolIndex + parallelizableBlocks.length, userAttachments, abortControllerRef, isStoppingRef, setMessages: context.setMessages, setIsExecutingTool, executeToolAndContinue, logPrefix: '[ParallelExecutor:Serial]', mode });
  return { wasStopped: false, continueExecution: true };
}