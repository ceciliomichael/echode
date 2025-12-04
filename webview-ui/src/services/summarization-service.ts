/**
 * Summarization Service
 * Based on KiloCode's conversation summarization approach
 */

import type { Message } from '../types/chat';
import type { ContextSettings } from '../types/api-settings';
import { stripToolSections } from '../utils/tool-context-cleaner';

/**
 * Default summary prompt following KiloCode's structured format
 */
export const DEFAULT_SUMMARY_PROMPT = `You are a specialized summarizer for AI coding assistant conversations. Your task is to create a concise but comprehensive summary that preserves all critical context needed for continuing the conversation.

Create a structured summary with the following sections:

## Previous Conversation Summary
A brief overview of what has been discussed and accomplished so far.

## Current Work
What is currently being worked on, including:
- The main task or feature being implemented
- Current progress and state
- Any blockers or issues encountered

## Key Technical Concepts
Important technical details that must be preserved:
- Architecture decisions made
- Design patterns being used
- Dependencies or integrations involved
- Code structure and organization

## Relevant Files
List of files that have been read, created, or modified:
- File paths and their purpose
- Key changes made to each file
- Any pending changes or todos for files

## Problem Solving
- Issues that were encountered and how they were resolved
- Debugging steps taken
- Workarounds or temporary solutions in place

## Pending Tasks
- Tasks that still need to be completed
- Known issues that need to be addressed
- Next steps planned

Be thorough but concise. Focus on preserving information that would be needed to continue this conversation effectively without losing important context.`;

/**
 * Number of recent messages to always keep (not summarize)
 */
export const N_MESSAGES_TO_KEEP = 4;

/**
 * Format message content for summarization
 * Strips tool XML sections and truncates very long content
 */
function formatMessageContent(content: string): string {
  // First strip tool sections to get clean conversational text
  const cleaned = stripToolSections(content);
  
  // Truncate very long content
  const maxLength = 2000;
  if (cleaned.length > maxLength) {
    return cleaned.slice(0, maxLength) + '\n... [truncated]';
  }
  return cleaned;
}

/**
 * Build the conversation string for summarization
 */
export function buildConversationForSummary(messages: Message[]): string {
  let conversation = '';
  
  for (const msg of messages) {
    const role = msg.role === 'user' ? '[USER]' : '[ASSISTANT]';
    const content = formatMessageContent(msg.content);
    conversation += `${role}\n${content}\n\n`;
    
    // Include tool execution summaries if present
    if (msg.toolExecutions && msg.toolExecutions.size > 0) {
      conversation += '[TOOL EXECUTIONS]\n';
      msg.toolExecutions.forEach((execution) => {
        conversation += `- ${execution.toolName}: ${execution.status}`;
        if (execution.result?.error) {
          conversation += ` (error: ${execution.result.error})`;
        }
        conversation += '\n';
      });
      conversation += '\n';
    }
  }
  
  return conversation;
}

/**
 * Prepare messages for summarization request
 * Returns: { messagesToSummarize, firstMessage, lastMessages }
 */
export function prepareMessagesForSummarization(
  messages: Message[],
  nMessagesToKeep: number = N_MESSAGES_TO_KEEP
): {
  messagesToSummarize: Message[];
  firstMessage: Message | undefined;
  lastMessages: Message[];
} {
  if (messages.length <= nMessagesToKeep + 1) {
    // Not enough messages to summarize
    return {
      messagesToSummarize: [],
      firstMessage: messages[0],
      lastMessages: messages.slice(1),
    };
  }
  
  const firstMessage = messages[0];
  const lastMessages = messages.slice(-nMessagesToKeep);
  
  // Messages to summarize are those between first and last N
  const endIndex = messages.length - nMessagesToKeep;
  const messagesToSummarize = messages.slice(1, endIndex);
  
  return {
    messagesToSummarize,
    firstMessage,
    lastMessages,
  };
}

/**
 * Build the summarization prompt
 */
export function buildSummarizationPrompt(messages: Message[]): string {
  const conversationText = buildConversationForSummary(messages);
  
  return `${DEFAULT_SUMMARY_PROMPT}

<conversation_to_summarize>
${conversationText}
</conversation_to_summarize>

Please provide a structured summary following the format specified above.`;
}

/**
 * Create a summary message to insert into conversation
 */
export function createSummaryMessage(summaryContent: string): Message {
  return {
    id: `summary-${Date.now()}`,
    role: 'assistant',
    content: `<conversation_summary>\n${summaryContent}\n</conversation_summary>`,
    timestamp: new Date(),
  };
}

/**
 * Check if summarization should be triggered based on context usage
 */
export function shouldTriggerSummarization(
  contextSettings: ContextSettings | undefined,
  totalTokens: number,
  maxTokens: number
): boolean {
  if (!contextSettings?.enabled) {
    return false;
  }
  
  const usagePercent = maxTokens > 0 ? (totalTokens / maxTokens) * 100 : 0;
  return usagePercent >= contextSettings.thresholdPercent;
}

/**
 * Build the request payload for summarization LLM call
 */
export function buildSummarizationRequest(
  messages: Message[],
  contextSettings: ContextSettings
): {
  prompt: string;
  provider: string;
  model: string;
} {
  const { messagesToSummarize } = prepareMessagesForSummarization(messages);
  const prompt = buildSummarizationPrompt(messagesToSummarize);
  
  return {
    prompt,
    provider: contextSettings.provider,
    model: contextSettings.model,
  };
}

/**
 * Reconstruct conversation history after summarization
 */
export function reconstructHistoryWithSummary(
  messages: Message[],
  summaryContent: string,
  nMessagesToKeep: number = N_MESSAGES_TO_KEEP
): Message[] {
  const { firstMessage, lastMessages } = prepareMessagesForSummarization(messages, nMessagesToKeep);
  
  const newHistory: Message[] = [];
  
  // Keep the first message (original task)
  if (firstMessage) {
    newHistory.push(firstMessage);
  }
  
  // Insert the summary
  newHistory.push(createSummaryMessage(summaryContent));
  
  // Add the last N messages
  for (const msg of lastMessages) {
    // Skip if it's the same as firstMessage (avoid duplicates)
    if (firstMessage && msg.id === firstMessage.id) {
      continue;
    }
    newHistory.push(msg);
  }
  
  return newHistory;
}
