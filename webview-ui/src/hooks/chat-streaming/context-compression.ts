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

    console.log('[Chat] Already compressed, checking re-compression:', {
      compressedContextTokens: currentCompressedTokens,
      compressedMessagesCount: currentCompressedMessages.length,
      newMessageTokens,
      projectedTokens,
      maxTokens,
      needsRecompression,
    });

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
  console.log('[Chat] Compression analysis:', {
    messageCount: messagesToSend.length,
    needsCompression: compressionAnalysis.needsCompression,
    estimatedTokens: compressionAnalysis.estimatedTokens,
    maxTokens,
    alreadyCompressed: currentCompressedTokens !== null,
    firstMsgCount: compressionAnalysis.firstMessages.length,
    middleMsgCount: compressionAnalysis.middleMessages.length,
    recentMsgCount: compressionAnalysis.recentMessages.length,
  });

  // Context messages - use compressed context if available, otherwise original
  let contextMessages = contextBase;

  if (compressionAnalysis.needsCompression && compressionAnalysis.middleMessages.length > 0) {
    console.log('[Chat] Context compression triggered:', {
      estimatedTokens: compressionAnalysis.estimatedTokens,
      firstMessages: compressionAnalysis.firstMessages.length,
      middleMessages: compressionAnalysis.middleMessages.length,
      recentMessages: compressionAnalysis.recentMessages.length,
    });

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
        console.log('[Chat] Compression aborted before start');
        setIsCompressing(false);
        return { contextMessages, wasAborted: true };
      }

      // Request summary from backend
      const summaryResult = await compressor.requestSummary(compressionAnalysis.middleMessages);

      // Check if aborted after compression completed
      if (abortControllerRef.current?.signal.aborted) {
        console.log('[Chat] Compression aborted after completion');
        setIsCompressing(false);
        return { contextMessages, wasAborted: true };
      }

      if (summaryResult.success && summaryResult.summary) {
        console.log('[Chat] Context compressed successfully');

        // Build compressed messages array for LLM context:
        // [first messages] + [summary as assistant message] + [recent messages]
        const newCompressedMessages: Message[] = [];

        // Add first messages (original user task + responses)
        newCompressedMessages.push(...compressionAnalysis.firstMessages);

        // Add summary as an assistant message
        if (summaryResult.summary) {
          newCompressedMessages.push({
            id: `compressed-summary-${Date.now()}`,
            role: 'assistant',
            content: `[Context Summary]\n${summaryResult.summary}`,
            timestamp: new Date(),
          });
        }

        // Add recent messages
        newCompressedMessages.push(...compressionAnalysis.recentMessages);

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
        console.log('[Chat] Compressed context, anchor:', userMessageId, 'tokens:', compressedTokens);
      } else {
        console.warn('[Chat] Context compression failed:', summaryResult.error);
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
