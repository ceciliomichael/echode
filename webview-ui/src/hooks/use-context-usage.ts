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
  thresholdPercent: number;
  isOverThreshold: boolean;
}

interface UseContextUsageOptions {
  systemPrompt: string;
  messages: Message[];
  currentToolResultText?: string;
  contextSettings?: ContextSettings;
}

/**
 * Hook to calculate current context usage in tokens
 */
export function useContextUsage({
  systemPrompt,
  messages,
  currentToolResultText = '',
  contextSettings = DEFAULT_CONTEXT_SETTINGS,
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
    
    const totalTokens = systemPromptTokens + historyTokens + toolResultsTokens;
    const maxTokens = contextSettings.maxContextTokens;
    const thresholdPercent = contextSettings.thresholdPercent;
    
    const usagePercent = maxTokens > 0 ? (totalTokens / maxTokens) * 100 : 0;
    const isOverThreshold = usagePercent >= thresholdPercent;
    
    return {
      systemPromptTokens,
      historyTokens,
      toolResultsTokens,
      totalTokens,
      maxTokens,
      thresholdPercent,
      isOverThreshold,
    };
  }, [systemPrompt, messages, currentToolResultText, contextSettings]);
}

/**
 * Utility function to check if summarization should be triggered
 */
export function shouldTriggerSummarization(usage: ContextUsageResult, enabled: boolean): boolean {
  return enabled && usage.isOverThreshold;
}
