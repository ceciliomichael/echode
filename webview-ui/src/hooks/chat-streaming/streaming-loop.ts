import type { StreamingLoopContext } from './types';
import type { ToolExecutionState, ParsedToolBlock } from '../../types/tool';
import { chatApi } from '../../services/chat-api';
import { hasCompleteToolBlock, trimToFirstCompleteToolBlock, extractCompleteInvokeBlocksIncremental } from '../../lib/tool-parser';
import { generateToolExecutionId, createToolExecutionState, updateToolExecutionStatus } from '../../lib/tool-execution-tracker';
import { isRetryableError } from './helpers';
import { ToolExecutor } from '../../lib/tool-executor';

/**
 * Result of the streaming loop
 */
export interface StreamingLoopResult {
  success: boolean;
  assistantContent: string;
  handledByToolExecution: boolean;
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
 * Execute a single tool in parallel and return the result
 * Does NOT await - returns a Promise that resolves when the tool completes
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
 * Run the streaming loop with PARALLEL tool execution and auto-retry
 * Tools are executed as each <invoke> block closes, but results are only
 * sent to AI after </function_calls> closes
 */
export async function runStreamingLoop(ctx: StreamingLoopContext): Promise<StreamingLoopResult> {
  const {
    finalChatHistory,
    messagesToSend,
    content,
    attachments,
    assistantMessageId,
    mode,
    isStoppingRef,
    abortControllerRef,
    hasStreamedContentRef,
    setMessages,
    setIsExecutingTool,
    updateToolExecution,
    executeToolAndContinue,
    getToolExecutor,
  } = ctx;

  let assistantContent = '';
  let pendingUpdate = false;

  // Batched update function for smooth 60fps rendering
  const updateUI = () => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantMessageId
          ? { ...msg, content: assistantContent }
          : msg
      )
    );
    pendingUpdate = false;
  };

  // Auto-retry loop for HTTP errors - keeps trying until success or user abort
  let retryCount = 0;
  let streamSuccess = false;

  while (!streamSuccess && !isStoppingRef.current) {
    try {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Reset content on retry
      if (retryCount > 0) {
        assistantContent = '';
        // Update UI to clear error message
        updateUI();
      }

      // Track which tool indices have started execution (parallel execution)
      const executingToolIndices = new Set<number>();
      // Store parallel execution promises and their results
      const parallelExecutions: Map<number, Promise<ParallelToolResult>> = new Map();

      console.log('[StreamingLoop] STARTING chatApi.streamChat call with PARALLEL tool execution');
      for await (const chunk of chatApi.streamChat(finalChatHistory, abortController.signal, mode)) {

        if (isStoppingRef.current) {
          streamSuccess = true;
          break;
        }

        if (abortController.signal.aborted) {
          streamSuccess = true; // User aborted, don't retry
          break;
        }

        assistantContent += chunk;
        if (!hasStreamedContentRef.current && assistantContent.length > 0) {
          hasStreamedContentRef.current = true;
        }

        // Check for complete and pending invoke blocks (incremental execution)
        const { blocks, pendingBlocks, hasFunctionCallsClose } = extractCompleteInvokeBlocksIncremental(assistantContent);

        // Update pending execution states for invoke blocks that have opened but not closed yet
        // This allows the UI to show them as "pending" with streaming content
        for (let i = 0; i < pendingBlocks.length; i++) {
          const pendingIndex = blocks.length + i; // Pending blocks come after complete blocks
          const pending = pendingBlocks[i];
          const execId = generateToolExecutionId(assistantMessageId, pendingIndex);

          // Create/update pending state (status: 'pending') so UI shows streaming content
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
        // but DON'T wait for results - collect them after </function_calls>
        for (let i = 0; i < blocks.length; i++) {
          if (!executingToolIndices.has(i)) {
            executingToolIndices.add(i);
            const block = blocks[i];
            const toolIndex = i;
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
              toolIndex,
              execId,
              executionState,
              assistantMessageId,
              getToolExecutor,
              updateToolExecution,
              isStoppingRef
            );
            parallelExecutions.set(toolIndex, executionPromise);

            console.log(`[StreamingLoop] Started parallel execution for tool ${toolIndex}: ${block.toolName}`);
          }
        }

        // Check if function_calls is now closed - WAIT for all parallel executions and send results
        if (hasFunctionCallsClose && blocks.length > 0) {
          console.log(`[StreamingLoop] </function_calls> closed - waiting for ${parallelExecutions.size} parallel tool executions`);

          // Trim content to the complete function_calls block
          const trimmedContent = trimToFirstCompleteToolBlock(assistantContent);
          assistantContent = trimmedContent;
          updateUI();

          // Abort stream
          abortController.abort();

          // Mark as executing tools
          setIsExecutingTool(true);

          // Check if user stopped before waiting for results
          if (isStoppingRef.current) {
            setIsExecutingTool(false);
            return { success: false, assistantContent, handledByToolExecution: true };
          }

          // Wait for ALL parallel executions to complete
          const allResults = await Promise.all(
            Array.from(parallelExecutions.values())
          );

          // Sort results by toolIndex to maintain order
          allResults.sort((a, b) => a.toolIndex - b.toolIndex);

          console.log(`[StreamingLoop] All ${allResults.length} parallel executions completed`);

          // Collect all tool results into buffered results
          const bufferedToolResults = allResults.map(r => r.result);

          // Check if user stopped after executions completed
          if (isStoppingRef.current) {
            setIsExecutingTool(false);
            return { success: false, assistantContent, handledByToolExecution: true };
          }

          // Continue with all buffered results
          await executeToolAndContinue(
            assistantContent,
            assistantMessageId,
            finalChatHistory,
            messagesToSend,
            content,
            0,
            attachments,
            bufferedToolResults,
          );
          return { success: true, assistantContent, handledByToolExecution: true };
        }

        // Batch updates: only update UI every 16ms (60fps) for smooth performance
        if (!pendingUpdate) {
          pendingUpdate = true;
          requestAnimationFrame(updateUI);
        }
      }

      // Final update to ensure all content is displayed
      if (pendingUpdate) {
        updateUI();
      }

      // POST-STREAM SAFETY CHECK: detect tool blocks that may have completed
      // in the final chunks but were not detected during streaming
      if (hasCompleteToolBlock(assistantContent)) {
        // Check if user stopped before executing tools
        if (isStoppingRef.current) {
          return { success: false, assistantContent, handledByToolExecution: false };
        }

        const trimmedContent = trimToFirstCompleteToolBlock(assistantContent);
        assistantContent = trimmedContent;
        updateUI();

        setIsExecutingTool(true);

        await executeToolAndContinue(
          assistantContent,
          assistantMessageId,
          finalChatHistory,
          messagesToSend,
          content,
          0,
          attachments,
        );

        return { success: true, assistantContent, handledByToolExecution: true };
      }

      // Stream completed successfully
      streamSuccess = true;

    } catch (streamError) {
      const errorMessage = streamError instanceof Error ? streamError.message : 'Unknown error';

      // Check if user manually aborted
      if (abortControllerRef.current?.signal.aborted || isStoppingRef.current) {
        streamSuccess = true; // Don't retry on user abort
      } else if (isRetryableError(errorMessage)) {
        retryCount++;

        // Show retry status in UI only if nothing has streamed yet
        if (!assistantContent) {
          assistantContent = `⟳ Retrying... (attempt ${retryCount})`;
          updateUI();
        }

        // Brief delay before retry (exponential backoff capped at 5s)
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * retryCount, 5000)));
      } else {
        // Non-retryable error, stop without overwriting any streamed content
        console.error('[STREAMING] Non-retryable error:', streamError);
        if (!assistantContent) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: `Error: ${errorMessage}` }
                : msg
            )
          );
        }
        streamSuccess = true; // Stop retrying for non-retryable errors
      }
    }
  }

  return { success: streamSuccess, assistantContent, handledByToolExecution: false };
}
