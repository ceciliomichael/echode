import { useMemo } from 'react';
import type { Message } from '../types/chat';
import type { ContextSettings } from '../types/api-settings';
import { DEFAULT_CONTEXT_SETTINGS } from '../types/api-settings';
import { formatToolResultForAI } from '../utils/tool-execution-helpers';

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
 * that will remain after revert
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
        effectiveMessages = messages.slice(0, revertIndex);
      }
    }

    // Calculate system prompt tokens
    const systemPromptTokens = estimateTokens(systemPrompt);

    // Calculate history tokens (messages without their tool executions)
    let historyTokens = 0;
    let toolResultsTokens = 0;

    effectiveMessages.forEach((message) => {
      historyTokens += estimateTokens(message.content);

      // Calculate tool results separately
      if (message.toolExecutions && message.toolExecutions.size > 0) {
        message.toolExecutions.forEach((execution) => {
          toolResultsTokens += estimateTokens(execution.toolName);
          toolResultsTokens += estimateTokens(JSON.stringify(execution.parameters || {}));

          if (execution.result) {
            // Use the same formatter as the actual AI prompt to get accurate token counts
            // This prevents massive over-estimation for file tools (apply_diff, write_to_file)
            // which return full file content in the result object but truncate it for the AI
            const formattedResult = formatToolResultForAI(execution.toolName, execution.result);
            toolResultsTokens += estimateTokens(formattedResult);
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
    };
  }, [systemPrompt, messages, currentToolResultText, contextSettings, revertPreviewMessageId]);
}
