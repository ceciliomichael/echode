/**
 * Single Executor Module
 * 
 * Handles execution of a single tool with progress tracking.
 * Manages execution state, diagnostics, and continuation for individual tools.
 */
import type { Message, ImageAttachment } from '../../types/chat';
import type { ToolBlock, ToolExecutionContext, ExecuteToolAndContinueFn } from './types';
import { ToolExecutor } from '../../lib/tool-executor';
import { createToolExecutionState, updateToolExecutionStatus, updateToolExecutionProgress, generateToolExecutionId } from '../../lib/tool-execution-tracker';
import { buildContinuationHistory } from '../../utils/continuation-builder';
import { executeToolWithStopCheck, type ToolProgressCallback } from '../../utils/tool-execution-helpers';
import { getDiagnosticsFromToolResult } from './diagnostics-handler';
import { runContinuationStream } from './continuation-stream';

/**
 * Parameters for single tool execution
 */
export interface SingleExecutionParams {
  toolBlock: ToolBlock;
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
 * Result from single execution
 */
export interface SingleExecutionResult {
  wasStopped: boolean;
  isPlanningTool: boolean;
  continueExecution: boolean;
}

/**
 * Execute a single tool and handle continuation
 */
export async function executeSingleTool(
  params: SingleExecutionParams
): Promise<SingleExecutionResult> {
  const {
    toolBlock,
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
    return { wasStopped: true, isPlanningTool: false, continueExecution: false };
  }

  // Create a new AbortController for tool execution
  const toolAbortController = new AbortController();
  abortControllerRef.current = toolAbortController;

  // Create progress callback for echo_search iterations
  const onProgress: ToolProgressCallback = (progress) => {
    const updatedState = updateToolExecutionProgress(executionState, progress);
    updateToolExecution(assistantMessageId, toolExecutionId, updatedState);
  };

  // Execute the specific tool directly
  const result = await executeToolWithStopCheck(
    toolExecutor,
    toolBlock,
    isStoppingRef,
    toolBlock.toolName === 'echo_search' ? onProgress : undefined,
    toolAbortController.signal
  );

  if (result.wasStopped) {
    const abortedState = updateToolExecutionStatus(executionState, 'aborted', {
      success: false,
      error: 'Stopped by user'
    });
    updateToolExecution(assistantMessageId, toolExecutionId, abortedState);
    setIsExecutingTool(false);
    return { wasStopped: true, isPlanningTool: false, continueExecution: false };
  }

  if (result.executedToolCalls.length === 0) {
    setIsExecutingTool(false);
    return { wasStopped: false, isPlanningTool: false, continueExecution: false };
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
    return { wasStopped: false, isPlanningTool: true, continueExecution: false };
  }

  // Format tool results for AI context
  const toolResultText = result.toolResults.join('\n\n');

  // Extract diagnostics from tool result (Roo Code approach - no external fetch needed)
  const diagnosticsText = getDiagnosticsFromToolResult(executedTool, diagnosticAttemptsRef);

  // Check if stopped during diagnostic processing
  if (isStoppingRef.current) {
    setIsExecutingTool(false);
    return { wasStopped: true, isPlanningTool: false, continueExecution: false };
  }

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
    userAttachments,
    toolIndex === 0  // isFirstIteration: only add user message on first tool
  );

  // Continue streaming - clear executing tool state
  setIsExecutingTool(false);

  await runContinuationStream({
    continuationHistory,
    assistantContent,
    assistantMessageId,
    messagesToSend,
    userContent,
    nextToolIndex: toolIndex + 1,
    userAttachments,
    abortControllerRef,
    isStoppingRef,
    setMessages: context.setMessages,
    setIsExecutingTool,
    executeToolAndContinue,
    logPrefix: '[SingleExecutor]',
    mode,
  });

  return { wasStopped: false, isPlanningTool: false, continueExecution: true };
}