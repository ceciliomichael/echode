/**
 * Shared utilities for chat history building.
 * Used by both chat-history-builder.ts and continuation message-processor.ts.
 */

import type { ChatMessage } from '../types/chat-api';

/**
 * Detect whether a user message is a system-injected tool result
 * (as opposed to an actual user-typed message).
 */
function isToolResultMessage(content: string): boolean {
  return content.startsWith('[SYSTEM TOOL OUTPUT]') ||
    content.startsWith('<tool_results>') ||
    content.startsWith('<tool_results_summary>');
}

/**
 * Merge consecutive messages with the same role to prevent protocol violations.
 * 
 * When tool results (role: 'user') are injected after an assistant message,
 * and the next conversation message is also 'user', we get consecutive user messages.
 * Most LLM APIs expect strict alternation: user → assistant → user → assistant.
 * 
 * This function merges consecutive same-role messages by joining their content
 * with a separator, preserving the conversation flow.
 * 
 * IMPORTANT: Tool result messages (prefixed with [SYSTEM TOOL OUTPUT]) are NEVER
 * merged with real user messages. This prevents the AI from interpreting user text
 * as tool output or vice versa.
 */
export function mergeConsecutiveSameRoleMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= 1) {
    return messages;
  }

  const merged: ChatMessage[] = [];

  for (const msg of messages) {
    const last = merged[merged.length - 1];

    // Only merge consecutive user messages (not system or assistant)
    // System messages should stay separate; assistant messages shouldn't be consecutive
    if (
      last &&
      last.role === 'user' &&
      msg.role === 'user' &&
      typeof last.content === 'string' &&
      typeof msg.content === 'string'
    ) {
      const lastIsTool = isToolResultMessage(last.content);
      const currentIsTool = isToolResultMessage(msg.content);

      // Never merge tool result messages with real user messages —
      // this prevents the AI from interpreting user text as tool output.
      // Insert a thin assistant acknowledgment to maintain role alternation.
      if (lastIsTool !== currentIsTool) {
        if (lastIsTool) {
          // Tool result (role:user) followed by real user message (role:user) —
          // insert a minimal assistant turn to maintain strict role alternation
          // and prevent the AI from interpreting user text as tool output.
          merged.push({ role: 'assistant', content: '[Received tool results above. The following is a new message from the user.]' });
        }
        merged.push({ ...msg });
      } else {
        last.content = `${last.content}\n\n${msg.content}`;
      }
    } else {
      // Push a shallow copy to avoid mutating the original
      merged.push({ ...msg });
    }
  }

  return merged;
}
