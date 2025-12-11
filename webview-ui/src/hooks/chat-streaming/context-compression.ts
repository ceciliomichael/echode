import type { Message } from '../../types/chat';
import type { CompressionContext, CompressionResult } from './types';
import { getContextCompressor } from '../../services/context-compressor';
import { storageService } from '../../utils/storage';
import { estimateTokens } from './helpers';

/**
 * Analyze and prepare context with optional compression
 * Returns the context messages to use for the LLM and whether the operation was aborted
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

  // Determine which messages to use for LLM context:
  // - If we have compressedMessages, use that as base (already compressed)
  // - Otherwise use full messagesToSend
  const contextBase = currentCompressedMessages ?? messagesToSend;

  // Analyze if compression is needed
  let compressionAnalysis;
  if (currentCompressedMessages !== null && currentCompressedTokens !== null) {
    // Already compressed - check if compressed context + new message exceeds limit
    const projectedTokens = currentCompressedTokens + newMessageTokens;
    const needsRecompression = projectedTokens >= maxTokens;

    if (needsRecompression) {
      // Need to re-compress - analyze the COMPRESSED messages, not full history
      compressionAnalysis = compressor.analyzeContext(
        currentCompressedMessages,
        systemPromptTokens,
        newMessageTokens
      );
    } else {
      // No need to compress - use existing compressed context
      compressionAnalysis = {
        needsCompression: false,
        firstMessages: [],
        middleMessages: [],
        recentMessages: currentCompressedMessages,
        estimatedTokens: projectedTokens,
      };
    }
  } else {
    // Not yet compressed - analyze full messages normally
    compressionAnalysis = compressor.analyzeContext(
      messagesToSend,
      systemPromptTokens,
      newMessageTokens
    );
  }

  // Debug: Log compression analysis

  // Context messages - use compressed context if available, otherwise original
  let contextMessages = contextBase;

  if (compressionAnalysis.needsCompression && compressionAnalysis.middleMessages.length > 0) {

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
        return { contextMessages, wasAborted: true };
      }

      // Request summary from backend
      const summaryResult = await compressor.requestSummary(compressionAnalysis.middleMessages);

      // Check if aborted after compression completed
      if (abortControllerRef.current?.signal.aborted) {
        setIsCompressing(false);
        return { contextMessages, wasAborted: true };
      }

      if (summaryResult.success && summaryResult.summary) {

        // Build compressed messages array for LLM context:
        // [first messages] + [summary as assistant message] + [recent messages]
        // CRITICAL: Strip tool executions from all messages - they're summarized now
        // and the token estimate only counts content, not tool executions
        const newCompressedMessages: Message[] = [];

        // Helper to strip tool executions from a message
        const stripToolExecutions = (msg: Message): Message => ({
          ...msg,
          toolExecutions: undefined,
        });

        // Add first messages without tool executions
        newCompressedMessages.push(...compressionAnalysis.firstMessages.map(stripToolExecutions));

        // Add summary as an assistant message
        if (summaryResult.summary) {
          newCompressedMessages.push({
            id: `compressed-summary-${Date.now()}`,
            role: 'assistant',
            content: `[Context Summary]\n${summaryResult.summary}`,
            timestamp: new Date(),
          });
        }

        // Add recent messages without tool executions
        newCompressedMessages.push(...compressionAnalysis.recentMessages.map(stripToolExecutions));

        contextMessages = newCompressedMessages;

        // Calculate and store compressed context token count
        let compressedTokens = systemPromptTokens;
        newCompressedMessages.forEach((msg) => {
          compressedTokens += estimateTokens(msg.content);
        });
        compressedTokens += newMessageTokens;

        // Store compressed messages for future use (update both state and refs)
        setCompressedMessages(newCompressedMessages);
        setCompressedContextTokens(compressedTokens);
        setCompressionAnchorId(userMessageId); // Mark this message as compression trigger
        compressedMessagesRef.current = newCompressedMessages;
        compressedContextTokensRef.current = compressedTokens;
      } else {
        // Fall back to original messages if compression fails
      }
    } catch (compressionError) {
      console.error('[Chat] Context compression error:', compressionError);
      // Fall back to original messages
    }

    // Compression done - reset content and switch to streaming state
    setIsCompressing(false);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantMessageId
          ? { ...msg, content: '' }
          : msg
      )
    );
  }
  return { contextMessages, wasAborted: false };
}
