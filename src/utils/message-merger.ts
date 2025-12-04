/**
 * Message Merger Utility
 * 
 * Merges consecutive same-role messages to create cleaner conversation history.
 * Based on KiloCode's addToApiConversationHistory pattern.
 */

import { ChatMessage, ChatMessageContent } from '../services/llm/llm-provider.interface';

/**
 * Merge consecutive messages with the same role into single messages.
 * This prevents issues with providers that don't handle consecutive same-role messages well,
 * and creates a cleaner context for the LLM.
 * 
 * @param messages - Array of chat messages
 * @returns Merged messages array
 */
export function mergeSameRoleChatMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= 1) {
    return messages;
  }

  const merged: ChatMessage[] = [];
  
  for (const message of messages) {
    const lastMessage = merged[merged.length - 1];
    
    // If same role as previous, merge the content
    if (lastMessage && lastMessage.role === message.role) {
      lastMessage.content = mergeContent(lastMessage.content, message.content);
    } else {
      // Different role or first message - add as new entry
      merged.push({ ...message });
    }
  }
  
  return merged;
}

/**
 * Merge two content values (string or array) into one
 */
function mergeContent(
  content1: string | ChatMessageContent[],
  content2: string | ChatMessageContent[]
): string | ChatMessageContent[] {
  // Both strings - simple concatenation
  if (typeof content1 === 'string' && typeof content2 === 'string') {
    return `${content1}\n\n${content2}`;
  }
  
  // Convert to arrays and merge
  const arr1 = normalizeToArray(content1);
  const arr2 = normalizeToArray(content2);
  
  return [...arr1, ...arr2];
}

/**
 * Normalize content to array format
 */
function normalizeToArray(content: string | ChatMessageContent[]): ChatMessageContent[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }
  return content;
}
