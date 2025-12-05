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
}

interface UseContextUsageOptions {
  systemPrompt: string;
  messages: Message[];
  currentToolResultText?: string;
  contextSettings?: ContextSettings;
  compressedContextTokens?: number | null;
}

/**
 * Hook to calculate current context usage in tokens
 */
export function useContextUsage({
  systemPrompt,
  messages,
  currentToolResultText = '',
  contextSettings = DEFAULT_CONTEXT_SETTINGS,
  compressedContextTokens,
}: UseContextUsageOptions): ContextUsageResult {
  return useMemo(() => {
    // Calculate system prompt tokens
    const systemPromptTokens = estimateTokens(systemPrompt);
    
    // Calculate history tokens (messages without their tool executions)
    let historyTokens = 0;
    let toolResultsTokens = 0;
    
    messages.forEach((message) => {
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
    
    // Use compressed context tokens if available (after summarization)
    // Otherwise use the calculated total
    const calculatedTotal = systemPromptTokens + historyTokens + toolResultsTokens;
    const totalTokens = compressedContextTokens ?? calculatedTotal;
    const maxTokens = contextSettings.maxContextTokens;
    
    return {
      systemPromptTokens,
      historyTokens,
      toolResultsTokens,
      totalTokens,
      maxTokens,
    };
  }, [systemPrompt, messages, currentToolResultText, contextSettings, compressedContextTokens]);
}
