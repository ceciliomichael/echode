/**
 * Single Executor Module
 *
 * Handles execution of a single tool with progress tracking.
 * Manages execution state and continuation for individual tools.
 */
import type { Message, ImageAttachment } from '../../types/chat';
import type { ToolBlock, ToolExecutionContext, ExecuteToolAndContinueFn, LockedModelConfig } from './types';
import { ToolExecutor } from '../../lib/tool-executor';
import { createToolExecutionState, updateToolExecutionStatus, generateToolExecutionId } from '../../lib/tool-execution-tracker';
import { buildContinuationHistory } from '../../utils/continuation-builder';
import { executeToolWithStopCheck, extractImageAttachmentsFromToolResult, type ToolProgressCallback } from '../../utils/tool-execution-helpers';
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
  lockedConfig?: LockedModelConfig;
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
    lockedConfig,
  } = params;

  const {
    isStoppingRef,
    abortControllerRef,
    setIsExecutingTool,
    updateToolExecution,
    messagesRef,
    mode,
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

  // Track accumulated progress for string-based streaming (run_terminal)
  // This is needed because the callback captures executionState which doesn't update
  let accumulatedStringProgress = '';

  // Create progress callback for terminal streaming
  const onProgress: ToolProgressCallback = (progress) => {
    let updatedState: typeof executionState;
    
    if (typeof progress === 'string') {
      // For string progress (terminal), accumulate in closure variable
      accumulatedStringProgress += progress;
      updatedState = {
        ...executionState,
        progress: accumulatedStringProgress,
      };
    } else {
      updatedState = executionState;
    }
    
    updateToolExecution(assistantMessageId, toolExecutionId, updatedState);
  };

  // Execute the specific tool directly
  const isProgressTool = toolBlock.toolName === 'run_terminal';
  const result = await executeToolWithStopCheck(
    toolExecutor,
    toolBlock,
    isStoppingRef,
    isProgressTool ? onProgress : undefined,
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
    // Check if this is a plan tool that awaits user action
    const awaitsUserAction = checkAwaitsUserAction(executedTool.result);
    
    if (awaitsUserAction) {
      // Update tool execution state with 'awaiting_user' status
      completedState = updateToolExecutionStatus(
        executionState,
        'awaiting_user',
        executedTool.result
      );
      updateToolExecution(assistantMessageId, toolExecutionId, completedState);
      
      // STOP HERE - Do not continue, wait for user interaction
      // The tool result is stored in the execution state
      // User must click a button to trigger continuation
      setIsExecutingTool(false);
      console.log('[SingleExecutor] Plan tool awaits user action - stopping execution');
      return { wasStopped: false, isPlanningTool: true, continueExecution: false };
    }
    
    // Update tool execution state with result - show in dropdown immediately
    completedState = updateToolExecutionStatus(
      executionState,
      executedTool.status,
      executedTool.result
    );
    updateToolExecution(assistantMessageId, toolExecutionId, completedState);
  }

  // Format tool results for AI context
  const toolResultText = result.toolResults.join('\n\n');

  // If the tool produced image payloads (e.g., read_file on an image), forward them as multimodal attachments.
  const toolResultAttachments: ImageAttachment[] | undefined = (() => {
    const executed = result.executedToolCalls[0];
    if (!executed) {
      return undefined;
    }
    const attachments = extractImageAttachmentsFromToolResult(executed.toolName, executed.result);
    return attachments.length > 0 ? attachments : undefined;
  })();

  // Check if stopped
  if (isStoppingRef.current) {
    setIsExecutingTool(false);
    return { wasStopped: true, isPlanningTool: false, continueExecution: false };
  }

  // Fetch diagnostics for any files that were modified by the tool
  // DISABLED: Diagnostics should be explicitly requested by the AI using get_diagnostics
  const diagnosticsText = ''; 

  // Compute which file paths were modified by this tool (and previous tools in this turn)
  // so stale detection works even if React state hasn't flushed yet
  const modifiedFilePaths = new Set<string>();
  // Check the current tool result
  if (executedTool?.result?.success) {
    const d = executedTool.result.data as Record<string, unknown> | undefined;
    if ((toolBlock.toolName === 'edit' || toolBlock.toolName === 'write_to_file') &&
        d?.path && typeof d.path === 'string' && d?.action !== 'no_change') {
      modifiedFilePaths.add(d.path);
    }
  }
  // Also check previous tool executions in this turn from stored state
  const assistantMsg = messagesRef.current.find(m => m.id === assistantMessageId);
  if (assistantMsg?.toolExecutions) {
    assistantMsg.toolExecutions.forEach((exec) => {
      if ((exec.toolName === 'edit' || exec.toolName === 'write_to_file') &&
          exec.status === 'completed' && exec.result?.success) {
        const d = exec.result.data as Record<string, unknown> | undefined;
        if (d?.action !== 'no_change' && d?.path && typeof d.path === 'string') {
          modifiedFilePaths.add(d.path);
        }
      }
    });
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
    mode,
    userAttachments,
    toolIndex === 0,  // isFirstIteration: only add user message on first tool
    toolResultAttachments,
    modifiedFilePaths
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
    updateToolExecution,
    getToolExecutor: context.getToolExecutor,
    logPrefix: '[SingleExecutor]',
    mode,
    lockedConfig,
  });

  return { wasStopped: false, isPlanningTool: false, continueExecution: true };
}

/**
 * Check if a tool result indicates it awaits user action
 * This is used by the plan tool to pause execution until user clicks a button
 */
function checkAwaitsUserAction(result?: { success: boolean; data?: unknown; error?: string }): boolean {
  if (!result?.success || !result.data) {
    return false;
  }
  
  const data = result.data as Record<string, unknown>;
  return data.awaitsUserAction === true;
}