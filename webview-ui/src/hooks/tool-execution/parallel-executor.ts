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

  // Execute all tools in parallel
  const parallelResult = await toolExecutor.executeToolBlocksInParallel(parallelizableBlocks);

  if (parallelResult.wasStopped) {
    markAllAsAborted(executionStates, assistantMessageId, updateToolExecution);
    setIsExecutingTool(false);
    return { wasStopped: true, continueExecution: false };
  }

  // Update all tool execution states with results
  console.log(`[ParallelExecutor] Execution complete. Results:`, parallelResult.executedToolCalls.length);
  
  const completedStates = parallelResult.executedToolCalls.map((executedTool, idx) => {
    const { state, execId } = executionStates[idx];
    console.log(`[ParallelExecutor] Updating result: idx=${idx}, execId=${execId}, toolName=${executedTool.toolName}, status=${executedTool.status}`);
    
    const completedState = updateToolExecutionStatus(
      state,
      executedTool.status,
      executedTool.result
    );
    updateToolExecution(assistantMessageId, execId, completedState);
    return { toolName: executedTool.toolName, result: executedTool.result, state: completedState };
  });

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
  const toolResultText = parallelResult.toolResults.join('\n\n');
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