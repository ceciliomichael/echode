import type { StreamingLoopContext } from './types';
import type { ToolExecutionState } from '../../types/tool';
import { chatApi } from '../../services/chat-api';
import { hasCompleteToolBlock, trimToFirstCompleteToolBlock, extractCompleteInvokeBlocksIncremental } from '../../lib/tool-parser';
import { createToolExecutionState, updateToolExecutionStatus, updateToolExecutionProgress, generateToolExecutionId } from '../../lib/tool-execution-tracker';
import { isRetryableError } from './helpers';

/**
 * Result of the streaming loop
 */
export interface StreamingLoopResult {
  success: boolean;
  assistantContent: string;
  handledByToolExecution: boolean;
}

/**
 * Run the streaming loop with incremental tool execution and auto-retry
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
        console.log(`[STREAMING] Retry attempt ${retryCount} for stream...`);
        assistantContent = '';
        // Update UI to clear error message
        updateUI();
      }

      console.log('[STREAMING] Starting stream...');
      let chunkCount = 0;

      // Incremental tool execution state
      const scheduledToolIndices = new Set<number>();
      const runningToolPromises: Promise<{ toolName: string; result: string; index: number }>[] = [];
      const toolExecutor = getToolExecutor();

      for await (const chunk of chatApi.streamChat(finalChatHistory, abortController.signal, mode)) {
        chunkCount++;
        console.log(`[STREAMING] Chunk #${chunkCount}:`, chunk);

        if (isStoppingRef.current) {
          console.log('[STREAMING] Stopping flag set, breaking stream');
          streamSuccess = true;
          break;
        }

        if (abortController.signal.aborted) {
          console.log('[STREAMING] Aborted signal received, breaking stream');
          streamSuccess = true; // User aborted, don't retry
          break;
        }

        assistantContent += chunk;
        if (!hasStreamedContentRef.current && assistantContent.length > 0) {
          hasStreamedContentRef.current = true;
        }
        console.log(`[STREAMING] Accumulated content length: ${assistantContent.length} chars`);

        // Check for complete and pending invoke blocks (incremental execution)
        const { blocks, pendingBlocks, hasFunctionCallsClose } = extractCompleteInvokeBlocksIncremental(assistantContent);

        // Update pending execution states for invoke blocks that have opened but not closed yet
        // This allows the UI to show them as "pending" with streaming content
        // We update on EVERY chunk so the parameters (content) are refreshed as they stream in
        for (let i = 0; i < pendingBlocks.length; i++) {
          const pendingIndex = blocks.length + i; // Pending blocks come after complete blocks
          const pending = pendingBlocks[i];
          const execId = generateToolExecutionId(assistantMessageId, pendingIndex);

          // Create/update pending state (status: 'pending') so UI shows streaming content
          const pendingState: ToolExecutionState = {
            toolExecutionId: execId,
            toolName: pending.toolName,
            parameters: pending.parameters, // Updated parameters with latest streamed content
            status: 'pending',
            startedAt: Date.now(),
          };
          updateToolExecution(assistantMessageId, execId, pendingState);
        }

        // Schedule execution for any new complete invoke blocks
        for (let i = 0; i < blocks.length; i++) {
          if (!scheduledToolIndices.has(i)) {
            scheduledToolIndices.add(i);
            const block = blocks[i];
            const toolIndex = i;

            console.log(`[STREAMING] Scheduling incremental execution for tool #${toolIndex}: ${block.toolName}`);

            // Show tool as executing in UI
            setIsExecutingTool(true);
            const execId = generateToolExecutionId(assistantMessageId, toolIndex);
            const executionState = createToolExecutionState(execId, block.toolName, block.parameters);
            updateToolExecution(assistantMessageId, execId, executionState);

            // Create progress callback for echo_search
            const onProgress = block.toolName === 'echo_search' 
              ? (progress: import('../../types/tool').EchoSearchProgress) => {
                  const updatedState = updateToolExecutionProgress(executionState, progress);
                  updateToolExecution(assistantMessageId, execId, updatedState);
                }
              : undefined;

            // Start execution in background (don't await)
            const toolPromise = (async () => {
              try {
                const result = await toolExecutor.executeToolBlock(block, onProgress);

                // Update UI with completed status
                if (result.executedToolCalls.length > 0) {
                  const executedTool = result.executedToolCalls[0];
                  const completedState = updateToolExecutionStatus(
                    executionState,
                    executedTool.status,
                    executedTool.result
                  );
                  updateToolExecution(assistantMessageId, execId, completedState);
                }

                return {
                  toolName: block.toolName,
                  result: result.toolResults[0] || '',
                  index: toolIndex,
                };
              } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                const errorState = updateToolExecutionStatus(executionState, 'error', {
                  success: false,
                  error: errorMsg,
                });
                updateToolExecution(assistantMessageId, execId, errorState);
                return {
                  toolName: block.toolName,
                  result: `[${block.toolName} ERROR] ${errorMsg}`,
                  index: toolIndex,
                };
              }
            })();

            runningToolPromises.push(toolPromise);
          }
        }

        // Check if function_calls is now closed
        if (hasFunctionCallsClose && blocks.length > 0) {
          console.log('[STREAMING] ✓ function_calls closed with tools executed incrementally!');

          // Trim content to the complete function_calls block
          const trimmedContent = trimToFirstCompleteToolBlock(assistantContent);
          assistantContent = trimmedContent;
          updateUI();

          // Abort stream
          abortController.abort();

          // Wait for all running tool executions to complete
          console.log(`[STREAMING] Waiting for ${runningToolPromises.length} tool executions to complete...`);
          const toolResults = await Promise.all(runningToolPromises);

          // Check if user stopped during tool execution
          if (isStoppingRef.current) {
            console.log('[STREAMING] User stopped during tool execution, not continuing AI');
            return { success: false, assistantContent, handledByToolExecution: true };
          }

          // Sort results by index and collect
          toolResults.sort((a, b) => a.index - b.index);

          // If any planning tools ran (plan_navigator / plan_handoff) in Plan mode,
          // stop here and wait for user interaction instead of auto-continuing.
          const hasPlanningTool = toolResults.some(r =>
            r.toolName === 'plan_navigator' || r.toolName === 'plan_handoff'
          );

          if (hasPlanningTool && mode === 'plan') {
            console.log('[STREAMING] Planning tool executed during incremental stream - waiting for user interaction');
            // Clear executing state since we are pausing for user input
            setIsExecutingTool(false);
            return { success: true, assistantContent, handledByToolExecution: true };
          }

          const bufferedResults = toolResults.map(r => r.result);

          console.log(`[STREAMING] All ${bufferedResults.length} tools completed, passing results to AI`);

          // Pass buffered results to executeToolAndContinue
          await executeToolAndContinue(
            assistantContent,
            assistantMessageId,
            finalChatHistory,
            messagesToSend,
            content,
            0,
            attachments,
            bufferedResults // Pass pre-computed results
          );

          console.log('[STREAMING] Tool execution completed, exiting stream');
          return { success: true, assistantContent, handledByToolExecution: true };
        }

        // Batch updates: only update UI every 16ms (60fps) for smooth performance
        if (!pendingUpdate) {
          pendingUpdate = true;
          requestAnimationFrame(updateUI);
        }
      }

      console.log('[STREAMING] Stream finished naturally, total chunks:', chunkCount);
      console.log('[STREAMING] Final content length:', assistantContent.length);

      // Final update to ensure all content is displayed
      if (pendingUpdate) {
        updateUI();
      }

      // POST-STREAM SAFETY CHECK: detect tool blocks that may have completed
      // in the final chunks but were not detected during streaming
      if (hasCompleteToolBlock(assistantContent)) {
        // Check if user stopped before executing tools
        if (isStoppingRef.current) {
          console.log('[STREAMING] User stopped, skipping post-stream tool execution');
          return { success: false, assistantContent, handledByToolExecution: false };
        }

        console.log('[STREAMING] ✓ Post-stream tool block detected - executing');

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
        console.log('[STREAMING] User aborted or stopping flag set, stopping retries');
        streamSuccess = true; // Don't retry on user abort
      } else if (isRetryableError(errorMessage)) {
        retryCount++;
        console.warn(`[STREAMING] Transient error, auto-retrying (attempt ${retryCount}):`, errorMessage);

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
