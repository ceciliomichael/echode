import { useMemo } from 'react';
import type { Message } from '../types/chat';
import type { ContextSettings } from '../types/api-settings';
import { DEFAULT_CONTEXT_SETTINGS } from '../types/api-settings';

/**
 * Estimate token count from text using ~4 characters per token
 * This is a conservative estimate that works well for English/code
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  // ~4 characters per token is a reasonable estimate
  return Math.ceil(text.length / 4);
}

export interface ContextUsageResult {
  systemPromptTokens: number;
  historyTokens: number;
  toolResultsTokens: number;
  totalTokens: number;
  maxTokens: number;
  isCompressed: boolean;
  compressionCount: number;
  totalMessagesSummarized: number;
}

interface UseContextUsageOptions {
  systemPrompt: string;
  messages: Message[];
  currentToolResultText?: string;
  contextSettings?: ContextSettings;
  revertPreviewMessageId?: string | null;
}

/**
 * Hook to calculate current context usage in tokens
 * When revertPreviewMessageId is set, calculates usage for the effective messages
 * that will remain after revert (excluding compression summaries)
 */
export function useContextUsage({
  systemPrompt,
  messages,
  currentToolResultText = '',
  contextSettings = DEFAULT_CONTEXT_SETTINGS,
  revertPreviewMessageId = null,
}: UseContextUsageOptions): ContextUsageResult {
  return useMemo(() => {
    // Calculate effective messages based on revert preview state
    let effectiveMessages = messages;
    
    if (revertPreviewMessageId) {
      const revertIndex = messages.findIndex(msg => msg.id === revertPreviewMessageId);
      if (revertIndex !== -1) {
        // Slice to get messages that will remain after revert
        // and filter out compression summaries (they get removed on revert)
        effectiveMessages = messages
          .slice(0, revertIndex)
          .filter(msg => !msg.id?.startsWith('compressed-summary-'));
      }
    }

    // Calculate system prompt tokens
    const systemPromptTokens = estimateTokens(systemPrompt);

    // Calculate history tokens (messages without their tool executions)
    let historyTokens = 0;
    let toolResultsTokens = 0;

    // Track compression state from effective messages
    const summaryMessages = effectiveMessages.filter(msg => msg.id?.startsWith('compressed-summary-'));
    const isCompressed = summaryMessages.length > 0;
    const compressionCount = summaryMessages.length;
    const totalMessagesSummarized = summaryMessages.reduce(
      (sum, msg) => sum + (msg.summarizedMessageCount || 0),
      0
    );

    effectiveMessages.forEach((message) => {
      historyTokens += estimateTokens(message.content);

      // Calculate tool results separately
      if (message.toolExecutions && message.toolExecutions.size > 0) {
        message.toolExecutions.forEach((execution) => {
          toolResultsTokens += estimateTokens(execution.toolName);
          toolResultsTokens += estimateTokens(JSON.stringify(execution.parameters || {}));

          if (execution.result) {
            if (execution.result.success && execution.result.data) {
              toolResultsTokens += estimateTokens(JSON.stringify(execution.result.data));
            } else if (execution.result.error) {
              toolResultsTokens += estimateTokens(execution.result.error);
            }
          }
        });
      }
    });

    // Add current tool result text if any
    if (currentToolResultText) {
      toolResultsTokens += estimateTokens(currentToolResultText);
    }

    const totalTokens = systemPromptTokens + historyTokens + toolResultsTokens;
    const maxTokens = contextSettings.maxContextTokens;

    return {
      systemPromptTokens,
      historyTokens,
      toolResultsTokens,
      totalTokens,
      maxTokens,
      isCompressed,
      compressionCount,
      totalMessagesSummarized,
    };
  }, [systemPrompt, messages, currentToolResultText, contextSettings, revertPreviewMessageId]);
}

