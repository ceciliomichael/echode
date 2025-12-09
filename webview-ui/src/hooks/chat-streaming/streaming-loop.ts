import type { StreamingLoopContext } from './types';
import type { ToolExecutionState } from '../../types/tool';
import { chatApi } from '../../services/chat-api';
import { hasCompleteToolBlock, trimToFirstCompleteToolBlock, extractCompleteInvokeBlocksIncremental } from '../../lib/tool-parser';
import { generateToolExecutionId } from '../../lib/tool-execution-tracker';
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

  console.log('[STREAMING] runStreamingLoop called with:', {
    chatHistoryLength: finalChatHistory.length,
    mode,
    isStoppingRef: isStoppingRef.current,
  });

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

      console.log('[STREAMING] Starting stream, creating chatApi.streamChat...');
      let chunkCount = 0;

      // Track which tool indices have been shown in UI
      const scheduledToolIndices = new Set<number>();

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
        
        console.log(`[STREAMING] Incremental check: blocks=${blocks.length}, pendingBlocks=${pendingBlocks.length}, hasFunctionCallsClose=${hasFunctionCallsClose}, scheduledToolIndices=${Array.from(scheduledToolIndices).join(',')}`);


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

        // Update UI state for complete invoke blocks (but do NOT execute yet)
        // Execution only happens when </function_calls> is received
        for (let i = 0; i < blocks.length; i++) {
          if (!scheduledToolIndices.has(i)) {
            scheduledToolIndices.add(i);
            const block = blocks[i];
            const toolIndex = i;

            console.log(`[STREAMING] Complete invoke block detected for tool #${toolIndex}: ${block.toolName} (waiting for </function_calls>)`);

            // Show tool as pending in UI (not executing yet)
            const execId = generateToolExecutionId(assistantMessageId, toolIndex);
            const pendingState: ToolExecutionState = {
              toolExecutionId: execId,
              toolName: block.toolName,
              parameters: block.parameters,
              status: 'pending',
              startedAt: Date.now(),
            };
            updateToolExecution(assistantMessageId, execId, pendingState);
          }
        }

        // Check if function_calls is now closed - ONLY THEN execute tools
        if (hasFunctionCallsClose && blocks.length > 0) {
          console.log('[STREAMING] ✓ </function_calls> received - NOW executing tools');

          // Trim content to the complete function_calls block
          const trimmedContent = trimToFirstCompleteToolBlock(assistantContent);
          assistantContent = trimmedContent;
          updateUI();

          // Abort stream
          abortController.abort();

          // Now execute all tools (will be handled by executeToolAndContinue which respects parallel allow-list)
          setIsExecutingTool(true);

          // Check if user stopped before executing
          if (isStoppingRef.current) {
            console.log('[STREAMING] User stopped before tool execution');
            setIsExecutingTool(false);
            return { success: false, assistantContent, handledByToolExecution: true };
          }

          // Delegate to executeToolAndContinue which handles parallel vs serial execution
          // based on the allow-list
          await executeToolAndContinue(
            assistantContent,
            assistantMessageId,
            finalChatHistory,
            messagesToSend,
            content,
            0,
            attachments,
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
