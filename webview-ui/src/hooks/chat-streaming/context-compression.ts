import type { Message } from '../../types/chat';
import type { CompressionContext, CompressionResult } from './types';
import { getContextCompressor } from '../../services/context-compressor';
import { storageService } from '../../utils/storage';
import { estimateTokens } from './helpers';

/**
 * Analyze and prepare context with optional compression
 * 
 * NEW APPROACH: When compression triggers, we summarize the ENTIRE conversation
 * and then start fresh. The summary is stored and prepended to the next user message.
 * This is like starting a new session but with context of what happened.
 */
export async function prepareContextWithCompression(
  ctx: CompressionContext
): Promise<CompressionResult> {
  const {
    messagesToSend,
    systemPromptTokens,
    newMessageTokens,
    maxTokens,
    currentCompressedMessages,
    currentCompressedTokens,
    userMessageId,
    assistantMessageId,
    abortControllerRef,
    setIsCompressing,
    setMessages,
    setCompressedMessages,
    setCompressedContextTokens,
    setCompressionAnchorId,
    compressedMessagesRef,
    compressedContextTokensRef,
  } = ctx;

  // Get compressor
  const settings = storageService.getSettings();
  const contextSettings = settings.contextSettings;
  const compressor = getContextCompressor(contextSettings);

  // If already compressed, we're working with a fresh context
  // Just check if the current context still fits
  if (currentCompressedMessages !== null && currentCompressedTokens !== null) {
    const projectedTokens = currentCompressedTokens + newMessageTokens;

    if (projectedTokens < maxTokens) {
      // Still fits - use existing compressed context
      return { contextMessages: currentCompressedMessages, wasAborted: false };
    }

    // Need to re-compress - but for now, just continue with current compressed context
    // Re-compression of already compressed content would lose too much
    console.log('[Compression] Projected tokens exceed limit, but already compressed. Using existing.');
    return { contextMessages: currentCompressedMessages, wasAborted: false };
  }

  // Calculate current context tokens (full history)
  let currentTokens = systemPromptTokens;
  messagesToSend.forEach((msg) => {
    currentTokens += estimateTokens(msg.content);
    // Include tool execution tokens
    if (msg.toolExecutions && msg.toolExecutions.size > 0) {
      msg.toolExecutions.forEach((execution) => {
        currentTokens += estimateTokens(execution.toolName);
        currentTokens += estimateTokens(JSON.stringify(execution.parameters || {}));
        if (execution.result?.data) {
          currentTokens += estimateTokens(JSON.stringify(execution.result.data));
        }
      });
    }
  });

  const totalAfterNewMessage = currentTokens + newMessageTokens;

  // Check if compression is needed
  if (totalAfterNewMessage < maxTokens) {
    // No compression needed - use full messages
    return { contextMessages: messagesToSend, wasAborted: false };
  }

  // Need at least some messages to compress
  if (messagesToSend.length < 2) {
    console.log('[Compression] Not enough messages to compress');
    return { contextMessages: messagesToSend, wasAborted: false };
  }

  console.log('[Compression] STARTING - summarizing entire conversation:', messagesToSend.length, 'messages');

  // Show compressing state
  setIsCompressing(true);
  setMessages((prev) =>
    prev.map((msg) =>
      msg.id === assistantMessageId
        ? { ...msg, content: '...' }
        : msg
    )
  );

  try {
    // Check if aborted before starting compression
    if (abortControllerRef.current?.signal.aborted) {
      setIsCompressing(false);
      return { contextMessages: messagesToSend, wasAborted: true };
    }

    // Summarize the ENTIRE conversation (all messages)
    const summaryResult = await compressor.requestSummary(messagesToSend);

    // Check if aborted after compression completed
    if (abortControllerRef.current?.signal.aborted) {
      setIsCompressing(false);
      return { contextMessages: messagesToSend, wasAborted: true };
    }

    if (summaryResult.success && summaryResult.summary) {
      // NEW APPROACH: After compression, context is EMPTY (fresh start)
      // The summary will be prepended to the user's message in buildChatHistoryWithToolResults
      const newCompressedMessages: Message[] = [];

      // Store the summary as a special "summary" message that will be prepended to user input
      newCompressedMessages.push({
        id: `compressed-summary-${Date.now()}`,
        role: 'user', // Will be combined with actual user message
        content: summaryResult.summary, // Raw summary, formatting happens when building history
        timestamp: new Date(),
        hidden: true, // Don't show in UI, it's internal context
      });

      // Calculate compressed token count (just the summary + system prompt)
      const summaryTokens = estimateTokens(summaryResult.summary);
      const compressedTokens = systemPromptTokens + summaryTokens;

      console.log('[Compression] DONE - reduced to summary only. Tokens:', compressedTokens);

      // Store compressed state
      setCompressedMessages(newCompressedMessages);
      setCompressedContextTokens(compressedTokens);
      setCompressionAnchorId(userMessageId);
      compressedMessagesRef.current = newCompressedMessages;
      compressedContextTokensRef.current = compressedTokens;

      // Return the compressed context (just the summary message)
      setIsCompressing(false);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: '' }
            : msg
        )
      );

      return { contextMessages: newCompressedMessages, wasAborted: false };
    } else {
      console.error('[Compression] Failed to generate summary:', summaryResult.error);
      // Fall back to original messages
    }
  } catch (compressionError) {
    console.error('[Chat] Context compression error:', compressionError);
    // Fall back to original messages
  }

  // Compression done but failed - reset state
  setIsCompressing(false);
  setMessages((prev) =>
    prev.map((msg) =>
      msg.id === assistantMessageId
        ? { ...msg, content: '' }
        : msg
    )
  );

  return { contextMessages: messagesToSend, wasAborted: false };
}
