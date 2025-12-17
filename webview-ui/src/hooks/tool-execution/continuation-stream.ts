/**
 * Continuation Stream Module
 * 
 * Handles streaming continuation after tool execution with retry logic.
 * Implements exponential backoff for transient errors.
 * 
 * Now supports PARALLEL tool execution just like the main streaming loop.
 */
import { chatApi } from '../../services/chat-api';
import { hasCompleteToolBlock, trimToFirstCompleteToolBlock, extractCompleteInvokeBlocksIncremental } from '../../lib/tool-parser';
import type { ChatMessage } from '../../types/chat-api';
import type { ChatMode } from '../../types/chat-mode';
import type { Message, ImageAttachment } from '../../types/chat';
import type { ToolExecutionState, ParsedToolBlock } from '../../types/tool';
import type { ExecuteToolAndContinueFn } from './types';
import { ToolExecutor } from '../../lib/tool-executor';
import { generateToolExecutionId, createToolExecutionState, updateToolExecutionStatus } from '../../lib/tool-execution-tracker';

const MAX_RETRY_DELAY_MS = 5000;

/**
 * Check if an error is retryable (transient network/server errors)
 */
export function isRetryableError(errorMessage: string): boolean {
  const lowerError = errorMessage.toLowerCase();
  return (
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
    lowerError.includes('fetch')
  );
}

/**
 * Calculate retry delay with exponential backoff
 */
export function calculateRetryDelay(retryCount: number): number {
  return Math.min(1000 * retryCount, MAX_RETRY_DELAY_MS);
}

/**
 * Parallel execution result for a single tool
 */
interface ParallelToolResult {
  toolIndex: number;
  toolName: string;
  result: string;
  success: boolean;
}

/**
 * Parameters for running a continuation stream
 */
export interface ContinuationStreamConfig {
  continuationHistory: ChatMessage[];
  assistantContent: string;
  assistantMessageId: string;
  messagesToSend: Message[];
  userContent: string;
  nextToolIndex: number;
  userAttachments?: ImageAttachment[];
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  isStoppingRef: React.MutableRefObject<boolean>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsExecutingTool: React.Dispatch<React.SetStateAction<boolean>>;
  executeToolAndContinue: ExecuteToolAndContinueFn;
  updateToolExecution?: (messageId: string, toolExecutionId: string, state: ToolExecutionState) => void;
  getToolExecutor?: () => ToolExecutor;
  logPrefix?: string;
  mode: ChatMode;
}

/**
 * Execute a single tool in parallel and return the result
 */
async function executeToolInParallel(
  block: ParsedToolBlock,
  toolIndex: number,
  execId: string,
  executionState: ToolExecutionState,
  assistantMessageId: string,
  getToolExecutor: () => ToolExecutor,
  updateToolExecution: (messageId: string, toolExecutionId: string, state: ToolExecutionState) => void,
  isStoppingRef: React.MutableRefObject<boolean>
): Promise<ParallelToolResult> {
  const toolExecutor = getToolExecutor();

  try {
    // Check if stopped before execution
    if (isStoppingRef.current) {
      const abortedState = updateToolExecutionStatus(executionState, 'aborted', {
        success: false,
        error: 'Stopped by user'
      });
      updateToolExecution(assistantMessageId, execId, abortedState);
      return {
        toolIndex,
        toolName: block.toolName,
        result: `Tool: ${block.toolName}\nError: Stopped by user`,
        success: false,
      };
    }

    // Execute the tool
    const result = await toolExecutor.execute({
      toolName: block.toolName,
      parameters: block.parameters,
      status: 'executing',
    });

    // Check if stopped after execution
    if (isStoppingRef.current) {
      const abortedState = updateToolExecutionStatus(executionState, 'aborted', {
        success: false,
        error: 'Stopped by user'
      });
      updateToolExecution(assistantMessageId, execId, abortedState);
      return {
        toolIndex,
        toolName: block.toolName,
        result: `Tool: ${block.toolName}\nError: Stopped by user`,
        success: false,
      };
    }

    // Update execution state with result
    const completedState = updateToolExecutionStatus(
      executionState,
      result.success ? 'completed' : 'error',
      result
    );
    updateToolExecution(assistantMessageId, execId, completedState);

    // Format result string
    const formattedResult = result.success
      ? `Tool: ${block.toolName}\nResult: ${JSON.stringify(result.data, null, 2)}`
      : `Tool: ${block.toolName}\nError: ${result.error}`;

    return {
      toolIndex,
      toolName: block.toolName,
      result: formattedResult,
      success: result.success,
    };
  } catch (error) {
    // Handle execution error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorState = updateToolExecutionStatus(executionState, 'error', {
      success: false,
      error: errorMessage
    });
    updateToolExecution(assistantMessageId, execId, errorState);

    return {
      toolIndex,
      toolName: block.toolName,
      result: `Tool: ${block.toolName}\nError: ${errorMessage}`,
      success: false,
    };
  }
}

/**
 * Run continuation stream with auto-retry for transient errors
 * Now supports PARALLEL tool execution
 * 
 * @returns true if stream completed successfully, false if aborted
 */
export async function runContinuationStream(config: ContinuationStreamConfig): Promise<boolean> {
  const {
    continuationHistory,
    assistantContent,
    assistantMessageId,
    messagesToSend,
    userContent,
    nextToolIndex,
    userAttachments,
    abortControllerRef,
    isStoppingRef,
    setMessages,
    setIsExecutingTool,
    executeToolAndContinue,
    updateToolExecution,
    getToolExecutor,
    mode,
  } = config;

  let continuationContent = assistantContent;
  let pendingUpdate = false;
  let retryCount = 0;
  let streamSuccess = false;

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

  while (!streamSuccess && !isStoppingRef.current) {
    try {
      const newAbortController = new AbortController();
      abortControllerRef.current = newAbortController;

      // Reset continuation content on retry (keep original assistant content)
      if (retryCount > 0) {
        continuationContent = assistantContent;
      }

      // Track parallel executions (like in streaming-loop.ts)
      const executingToolIndices = new Set<number>();
      const parallelExecutions: Map<number, Promise<ParallelToolResult>> = new Map();

      for await (const chunk of chatApi.streamChat(
        continuationHistory,
        newAbortController.signal,
        mode
      )) {
        if (newAbortController.signal.aborted || isStoppingRef.current) {
          streamSuccess = true; // User aborted, don't retry
          break;
        }

        continuationContent += chunk;

        // Check for tool blocks in the NEW content only (after the previous assistant content)
        const newContent = continuationContent.slice(assistantContent.length);

        // Use parallel execution if we have the required callbacks
        if (updateToolExecution && getToolExecutor) {
          const { blocks, pendingBlocks, hasFunctionCallsClose } = extractCompleteInvokeBlocksIncremental(newContent);

          // Update pending execution states for invoke blocks that have opened but not closed yet
          for (let i = 0; i < pendingBlocks.length; i++) {
            const pendingIndex = nextToolIndex + blocks.length + i;
            const pending = pendingBlocks[i];
            const execId = generateToolExecutionId(assistantMessageId, pendingIndex);

            const pendingState: ToolExecutionState = {
              toolExecutionId: execId,
              toolName: pending.toolName,
              parameters: pending.parameters,
              status: 'pending',
              startedAt: Date.now(),
            };
            updateToolExecution(assistantMessageId, execId, pendingState);
          }

          // START PARALLEL EXECUTION: Execute each complete invoke block immediately
          for (let i = 0; i < blocks.length; i++) {
            if (!executingToolIndices.has(i)) {
              executingToolIndices.add(i);
              const block = blocks[i];
              const toolIndex = nextToolIndex + i;
              const execId = generateToolExecutionId(assistantMessageId, toolIndex);

              // Create execution state (status: 'executing')
              const executionState = createToolExecutionState(
                execId,
                block.toolName,
                block.parameters
              );
              updateToolExecution(assistantMessageId, execId, executionState);

              // Start tool execution in parallel (don't await yet)
              const executionPromise = executeToolInParallel(
                block,
                i, // Use local index for sorting, will add nextToolIndex later
                execId,
                executionState,
                assistantMessageId,
                getToolExecutor,
                updateToolExecution,
                isStoppingRef
              );
              parallelExecutions.set(i, executionPromise);

              console.log(`[ContinuationStream] Started parallel execution for tool ${toolIndex}: ${block.toolName}`);
            }
          }

          // Check if function_calls is now closed - WAIT for all parallel executions
          if (hasFunctionCallsClose && blocks.length > 0) {
            console.log(`[ContinuationStream] </function_calls> closed - waiting for ${parallelExecutions.size} parallel tool executions`);

            const trimmedContinuation = assistantContent + trimToFirstCompleteToolBlock(newContent);
            continuationContent = trimmedContinuation;
            updateUI();

            // Abort stream
            newAbortController.abort();

            // Mark as executing tools
            setIsExecutingTool(true);

            // Check if user stopped
            if (isStoppingRef.current) {
              setIsExecutingTool(false);
              return false;
            }

            // Wait for ALL parallel executions to complete
            const allResults = await Promise.all(
              Array.from(parallelExecutions.values())
            );

            // Sort results by toolIndex to maintain order
            allResults.sort((a, b) => a.toolIndex - b.toolIndex);

            console.log(`[ContinuationStream] All ${allResults.length} parallel executions completed`);

            // Collect all tool results into buffered results
            const bufferedToolResults = allResults.map(r => r.result);

            // Check if user stopped after executions completed
            if (isStoppingRef.current) {
              setIsExecutingTool(false);
              return false;
            }

            // Continue with all buffered results
            await executeToolAndContinue(
              continuationContent,
              assistantMessageId,
              continuationHistory,
              messagesToSend,
              userContent,
              nextToolIndex,
              userAttachments,
              bufferedToolResults
            );
            return true;
          }
        } else {
          // Fallback to sequential execution (when parallel execution callbacks not available)
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
              nextToolIndex,
              userAttachments
            );
            return true;
          }
        }

        if (!pendingUpdate) {
          pendingUpdate = true;
          requestAnimationFrame(updateUI);
        }
      }

      // Stream completed successfully
      streamSuccess = true;
      // Final update
      updateUI();
    } catch (streamError) {
      const errorMessage = streamError instanceof Error ? streamError.message : 'Unknown error';

      // Check if user manually aborted
      if (abortControllerRef.current?.signal.aborted || isStoppingRef.current) {
        streamSuccess = true;
      } else if (isRetryableError(errorMessage)) {
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, calculateRetryDelay(retryCount)));
      } else {
        // Non-retryable error, rethrow
        throw streamError;
      }
    }
  }

  return streamSuccess;
}