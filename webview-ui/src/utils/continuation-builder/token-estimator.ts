/**
 * Token estimation utilities for context management
 */

import type { Message } from '../../types/chat';
import { formatToolResultForAI } from '../tool-execution-helpers';

/**
 * Estimate token count from text using ~4 characters per token
 * This is a rough approximation suitable for context management decisions
 */
export function estimateTokens(text: string): number {
  if (!text) {return 0;}
  return Math.ceil(text.length / 4);
}

/**
 * Calculate total context tokens for messages
 * Includes message content and tool execution data
 */
export function calculateContextTokens(
  systemPrompt: string,
  messages: Message[]
): number {
  let tokens = estimateTokens(systemPrompt);

  for (const msg of messages) {
    tokens += estimateTokens(msg.content);

    if (msg.toolExecutions && msg.toolExecutions.size > 0) {
      msg.toolExecutions.forEach((execution) => {
        tokens += estimateTokens(execution.toolName);
        tokens += estimateTokens(JSON.stringify(execution.parameters || {}));
        if (execution.result) {
          const formattedResult = formatToolResultForAI(execution.toolName, execution.result);
          tokens += estimateTokens(formattedResult);
        }
      });
    }
  }

  return tokens;
}