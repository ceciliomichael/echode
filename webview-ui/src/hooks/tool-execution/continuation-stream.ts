/**
 * Continuation Stream Module
 * 
 * Handles streaming continuation after tool execution with retry logic.
 * Implements exponential backoff for transient errors.
 */
import { chatApi } from '../../services/chat-api';
import { hasCompleteToolBlock, trimToFirstCompleteToolBlock } from '../../lib/tool-parser';
import type { ChatMessage } from '../../types/chat-api';
import type { ChatMode } from '../../types/chat-mode';
import type { Message, ImageAttachment } from '../../types/chat';
import type { ExecuteToolAndContinueFn } from './types';

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
  logPrefix?: string;
  mode: ChatMode;
}

/**
 * Run continuation stream with auto-retry for transient errors
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
      if (retryCount > 0) {        continuationContent = assistantContent;
      }
      for await (const chunk of chatApi.streamChat(
        continuationHistory,
        newAbortController.signal,
        mode
      )) {
        if (newAbortController.signal.aborted || isStoppingRef.current) {          streamSuccess = true; // User aborted, don't retry
          break;
        }

        continuationContent += chunk;

        // Check for another tool block in the new content only
        const newContent = continuationContent.slice(assistantContent.length);
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
      if (abortControllerRef.current?.signal.aborted || isStoppingRef.current) {        streamSuccess = true;
      } else if (isRetryableError(errorMessage)) {
        retryCount++;        await new Promise(resolve => setTimeout(resolve, calculateRetryDelay(retryCount)));
      } else {
        // Non-retryable error, rethrow
        throw streamError;
      }
    }
  }

  return streamSuccess;
}