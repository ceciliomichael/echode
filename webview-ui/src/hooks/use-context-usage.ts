import { useMemo } from 'react';
import type { Message } from '../types/chat';
import type { ChatMode } from '../types/chat-mode';
import type { ContextSettings } from '../types/api-settings';
import { DEFAULT_CONTEXT_SETTINGS } from '../types/api-settings';
import { formatToolResultForAI } from '../utils/tool-execution-helpers';
import { stripUnavailableToolCalls, isToolAvailableInMode } from '../utils/tool-history-filter';
import { parseThinkBlocks } from '../utils/think-block-parser';

/**
 * Estimate token count from text using ~4 characters per token
 * This is a conservative estimate that works well for English/code
 */
function estimateTokens(text: string): number {
  if (!text) {return 0;}
  // ~4 characters per token is a reasonable estimate
  return Math.ceil(text.length / 4);
}

export interface ContextUsageResult {
  systemPromptTokens: number;
  historyTokens: number;
  compressedHistoryTokens: number;
  toolResultsTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  maxTokens: number;
}

interface UseContextUsageOptions {
  systemPrompt: string;
  messages: Message[];
  mode?: ChatMode;
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
  mode = 'agent',
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
    let compressedHistoryTokens = 0;
    let toolResultsTokens = 0;
    let reasoningTokens = 0;

    effectiveMessages.forEach((message) => {
      // Check for compressed history
      if (message.content.trimStart().startsWith('<compressed_history>')) {
        const contentTokens = estimateTokens(message.content);
        compressedHistoryTokens += contentTokens;
      } else {
        // Apply filtering to content to match what is sent to LLM
        // Parse think blocks to track reasoning tokens separately
        const parsed = parseThinkBlocks(message.content);
        
        // Calculate tokens for reasoning content
        parsed.thinkBlocks.forEach(block => {
          // Add back tags for accurate estimation as they are part of context
          const blockContent = `<think>${block.content}</think>`;
          reasoningTokens += estimateTokens(blockContent);
        });

        // Use text content (without think blocks) for history tokens calculation
        const contentWithoutThink = parsed.textContent;
        const filteredContent = stripUnavailableToolCalls(contentWithoutThink, mode);
        historyTokens += estimateTokens(filteredContent);
      }

      // Calculate tool results separately
      if (message.toolExecutions && message.toolExecutions.size > 0) {
        message.toolExecutions.forEach((execution) => {
          // Skip tools that are not available in current mode
          if (!isToolAvailableInMode(execution.toolName, mode)) {
            return;
          }

          toolResultsTokens += estimateTokens(execution.toolName);
          toolResultsTokens += estimateTokens(JSON.stringify(execution.parameters || {}));

          if (execution.result) {
            // Use the same formatter as the actual AI prompt to get accurate token counts
            // This prevents massive over-estimation for file tools (edit, write_to_file)
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

    const totalTokens = systemPromptTokens + historyTokens + compressedHistoryTokens + toolResultsTokens + reasoningTokens;
    const maxTokens = contextSettings.maxContextTokens;

    return {
      systemPromptTokens,
      historyTokens,
      compressedHistoryTokens,
      toolResultsTokens,
      reasoningTokens,
      totalTokens,
      maxTokens,
    };
  }, [systemPrompt, messages, mode, currentToolResultText, contextSettings, revertPreviewMessageId]);
}
