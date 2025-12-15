import { useCallback, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Message } from '../types/chat';
import type { ContextSettings } from '../types/api-settings';
import { DEFAULT_CONTEXT_SETTINGS } from '../types/api-settings';
import { SummarizationService } from '../services/summarization-service';
import { storageService } from '../utils/storage';

/**
 * Estimate token count from text using ~4 characters per token
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Calculate total tokens for a message including tool executions
 */
function calculateMessageTokens(message: Message): number {
  let tokens = estimateTokens(message.content);

  if (message.toolExecutions && message.toolExecutions.size > 0) {
    message.toolExecutions.forEach((execution) => {
      tokens += estimateTokens(execution.toolName);
      tokens += estimateTokens(JSON.stringify(execution.parameters || {}));
      if (execution.result?.data) {
        tokens += estimateTokens(JSON.stringify(execution.result.data));
      }
    });
  }

  return tokens;
}

/**
 * Calculate total context tokens for messages
 */
function calculateTotalTokens(systemPrompt: string, messages: Message[], newContent: string): number {
  let tokens = estimateTokens(systemPrompt);
  tokens += estimateTokens(newContent);

  for (const msg of messages) {
    tokens += calculateMessageTokens(msg);
  }

  return tokens;
}

/**
 * Count how many times context has been compressed by counting summary messages
 */
function countCompressions(messages: Message[]): number {
  return messages.filter(msg => msg.id?.startsWith('compressed-summary-')).length;
}

/**
 * Find existing summary content to merge with new summary
 */
function getExistingSummaryContent(messages: Message[]): string | null {
  const summaryMessage = messages.find(msg => msg.id?.startsWith('compressed-summary-'));
  return summaryMessage?.content || null;
}

export interface SummarizationResult {
  messages: Message[];
  wasCompressed: boolean;
  compressionCount: number;
  originalTokens: number;
  compressedTokens: number;
  /** Original messages before compression, for revert support */
  preCompressionMessages?: Message[];
}

export interface UseContextSummarizationOptions {
  systemPrompt: string;
  contextSettings?: ContextSettings;
}

/**
 * Hook for managing context summarization
 * Automatically compresses conversation history when token threshold is exceeded
 */
export function useContextSummarization({ systemPrompt, contextSettings }: UseContextSummarizationOptions) {
  const isSummarizingRef = useRef(false);
  const [isCompressing, setIsCompressing] = useState(false);

  const settings = contextSettings || DEFAULT_CONTEXT_SETTINGS;

  /**
   * Check if summarization should be triggered and perform it if needed
   * Returns the (potentially compressed) messages array
   */
  const checkAndSummarize = useCallback(async (
    messages: Message[],
    newContent: string
  ): Promise<SummarizationResult> => {
    // Calculate current token usage
    const totalTokens = calculateTotalTokens(systemPrompt, messages, newContent);
    const threshold = settings.maxContextTokens * (settings.summarizationThreshold ?? 0.85);

    const result: SummarizationResult = {
      messages,
      wasCompressed: false,
      compressionCount: countCompressions(messages),
      originalTokens: totalTokens,
      compressedTokens: totalTokens,
    };

    // Check if summarization is enabled and needed
    if (!settings.summarizationEnabled) {
      return result;
    }

    if (totalTokens < threshold) {
      return result;
    }

    // Prevent concurrent summarization
    if (isSummarizingRef.current) {
      console.log('[Summarization] Already in progress, skipping');
      return result;
    }

    // Need at least 4 messages to summarize (first + at least 2 middle + current)
    // We keep first message and last few messages, summarize the rest
    if (messages.length < 4) {
      console.log('[Summarization] Not enough messages to summarize');
      return result;
    }

    console.log(`[Summarization] Threshold exceeded (${totalTokens}/${settings.maxContextTokens}), starting summarization`);

    isSummarizingRef.current = true;
    setIsCompressing(true);

    try {
      // Get storage settings for provider/model
      const apiSettings = storageService.getSettings();
      const provider = settings.summarizationProvider ?? apiSettings.provider;
      const model = settings.summarizationModel;

      if (!model) {
        console.warn('[Summarization] No model configured, skipping');
        return result;
      }

      // Find the first non-summary user message (original context)
      const firstMessageIndex = messages.findIndex(
        msg => msg.role === 'user' && !msg.hidden && !msg.id?.startsWith('compressed-summary-')
      );

      if (firstMessageIndex === -1) {
        console.warn('[Summarization] No first user message found');
        return result;
      }

      // Keep first message and last 2-4 messages (recent context)
      // Summarize everything in between
      const keepRecentCount = Math.min(4, Math.max(2, Math.floor(messages.length * 0.2)));
      const firstMessage = messages[firstMessageIndex];
      const recentMessages = messages.slice(-keepRecentCount);

      // Messages to summarize: everything between first and recent, excluding summary messages
      const middleStartIndex = firstMessageIndex + 1;
      const middleEndIndex = messages.length - keepRecentCount;

      if (middleEndIndex <= middleStartIndex) {
        console.log('[Summarization] Not enough middle messages to summarize');
        return result;
      }

      const middleMessages = messages.slice(middleStartIndex, middleEndIndex)
        .filter(msg => !msg.id?.startsWith('compressed-summary-'));

      if (middleMessages.length < 2) {
        console.log('[Summarization] Not enough middle messages after filtering');
        return result;
      }

      console.log(`[Summarization] Summarizing ${middleMessages.length} middle messages, keeping ${keepRecentCount} recent`);

      // Get existing summary to merge (for recursive summarization)
      const existingSummary = getExistingSummaryContent(messages);

      // Call summarization service
      const summarizationResult = await SummarizationService.summarizeMessages(
        middleMessages,
        provider,
        model
      );

      if (!summarizationResult.success) {
        console.error('[Summarization] Failed:', summarizationResult.error);
        return result;
      }

      // Build the summary content, merging with existing summary if present
      let summaryContent = summarizationResult.summary;
      if (existingSummary) {
        summaryContent = `## Previous Summary\n${existingSummary}\n\n## Latest Summary\n${summarizationResult.summary}`;
      }

      // Create the hidden summary message
      const summaryMessage: Message = {
        id: `compressed-summary-${uuidv4()}`,
        role: 'user',
        content: summaryContent,
        timestamp: new Date(),
        hidden: true,
        isSummary: true,
        summarizedMessageCount: summarizationResult.originalMessageCount,
      };

      // Build new message array: first message + summary + recent messages
      // Clear toolExecutions from recent messages - they're now incorporated into the summary
      // This gives us a "fresh start" where only NEW tool calls will be tracked
      const cleanedRecentMessages = recentMessages.map(msg => ({
        ...msg,
        toolExecutions: undefined,
      }));

      const compressedMessages: Message[] = [
        firstMessage,
        summaryMessage,
        ...cleanedRecentMessages,
      ];

      // Calculate new token count
      const compressedTokens = calculateTotalTokens(systemPrompt, compressedMessages, newContent);

      console.log(`[Summarization] Compressed from ${totalTokens} to ${compressedTokens} tokens`);

      return {
        messages: compressedMessages,
        wasCompressed: true,
        compressionCount: countCompressions(compressedMessages),
        originalTokens: totalTokens,
        compressedTokens,
        // Store original messages for potential revert
        preCompressionMessages: messages,
      };
    } catch (error) {
      console.error('[Summarization] Error:', error);
      return result;
    } finally {
      isSummarizingRef.current = false;
      setIsCompressing(false);
    }
  }, [systemPrompt, settings]);

  /**
   * Check if context is currently compressed
   */
  const isCompressed = useCallback((messages: Message[]): boolean => {
    return messages.some(msg => msg.id?.startsWith('compressed-summary-'));
  }, []);

  /**
   * Get compression statistics
   */
  const getCompressionStats = useCallback((messages: Message[]) => {
    const summaryMessages = messages.filter(msg => msg.id?.startsWith('compressed-summary-'));
    const totalSummarized = summaryMessages.reduce(
      (sum, msg) => sum + (msg.summarizedMessageCount || 0),
      0
    );

    return {
      isCompressed: summaryMessages.length > 0,
      compressionCount: summaryMessages.length,
      totalMessagesSummarized: totalSummarized,
    };
  }, []);

  return {
    checkAndSummarize,
    isCompressed,
    getCompressionStats,
    isSummarizing: isSummarizingRef.current,
    isCompressing,
  };
}