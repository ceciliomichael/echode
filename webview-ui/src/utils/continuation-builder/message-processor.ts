/**
 * Message processing utilities for continuation history
 */

import type { Message } from '../../types/chat';
import type { ChatMessage } from '../../types/chat-api';
import type { ChatMode } from '../../types/chat-mode';
import type { TruncationResult } from './types';
import { MAX_HISTORY_MESSAGES, N_MESSAGES_TO_ALWAYS_KEEP } from './constants';
import { buildChatMessage } from '../vision-utils';
import { summarizeToolSections, stripDiagnosticsSections } from '../tool-context-cleaner';
import { stripUnavailableToolCalls } from '../tool-history-filter';
import { formatToolResultsForHistory } from '../tool-result-formatter';

function appendOmittedImageAttachmentNote(content: string, msg: Message): string {
  if (!msg.attachments || msg.attachments.length === 0) {
    return content;
  }
  return `${content}\n[Image attachments: ${msg.attachments.length} omitted from context]`;
}

/**
 * Truncate message history to stay within context limits
 * Keeps first message (original task) + last N messages
 */
export function truncateMessageHistory(messages: Message[]): TruncationResult {
  if (messages.length <= MAX_HISTORY_MESSAGES) {
    return {
      messages,
      wasTruncated: false,
    };
  }

  // Keep first message (original task) + last N messages
  const firstMessage = messages[0];
  const lastMessages = messages.slice(-N_MESSAGES_TO_ALWAYS_KEEP);

  // Check if first message is already in the last messages (avoid duplicate)
  if (lastMessages.includes(firstMessage)) {
    return {
      messages: lastMessages,
      wasTruncated: true,
    };
  }

  return {
    messages: [firstMessage, ...lastMessages],
    wasTruncated: true,
  };
}

/**
 * Process the first message in the history
 * Handles content cleaning and tool result summarization when truncated
 */
export function processFirstMessage(
  msg: Message,
  wasTruncated: boolean,
  mode: ChatMode,
  modelSupportsVision: boolean
): ChatMessage[] {
  const result: ChatMessage[] = [];

  // If truncated, clean any embedded tool sections from old message content
  let cleanedContent = wasTruncated
    ? summarizeToolSections(msg.content)
    : msg.content;

  // If truncated, wrap in a block to distinguish it as historical context
  if (wasTruncated && msg.role === 'user') {
    cleanedContent = `<historical_context description="This is the original task/request from the start of the conversation. Focus on the LATEST user message at the bottom for the current instruction.">\n${cleanedContent}\n</historical_context>`;
  }

  // For assistant messages, strip tool call XML for tools not available in current mode
  if (msg.role === 'assistant') {
    cleanedContent = stripUnavailableToolCalls(cleanedContent, mode);
  }

  cleanedContent = appendOmittedImageAttachmentNote(cleanedContent, msg);

  const chatMessage = buildChatMessage(
    msg.role,
    cleanedContent,
    undefined,
    modelSupportsVision
  );
  result.push(chatMessage);

  // Add tool results for first message if any
  // When truncated, only add a brief summary instead of full results
  if (msg.toolExecutions && msg.toolExecutions.size > 0) {
    if (wasTruncated) {
      // Summarize old tool results
      const toolNames = Array.from(msg.toolExecutions.values())
        .map(t => t.toolName)
        .slice(0, 5)
        .join(', ');
      result.push({
        role: 'user',
        content: `[Previous tools used: ${toolNames}]`,
      });
    } else {
      // Keep full tool results for recent messages
      const toolResults = formatToolResultsForHistory(msg.toolExecutions, mode);
      if (toolResults.length > 0) {
        result.push({
          role: 'user',
          content: `<previous_tool_results>\n${toolResults.join('\n\n---\n\n')}\n</previous_tool_results>`,
        });
      }
    }
  }

  return result;
}

/**
 * Process remaining messages (after the first one)
 * Handles content cleaning and tool results for each message
 */
export function processRemainingMessages(
  messages: Message[],
  mode: ChatMode,
  modelSupportsVision: boolean
): ChatMessage[] {
  const result: ChatMessage[] = [];

  // Skip first message (index 0) since it's processed separately
  for (let i = 1; i < messages.length; i++) {
    const msg = messages[i];

    // For user messages, strip old <diagnostics> blocks to avoid stale diagnostic data
    // Fresh diagnostics for the current iteration are added separately
    let processedContent = msg.role === 'user'
      ? stripDiagnosticsSections(msg.content)
      : msg.content;

    // For assistant messages, strip tool call XML for tools not available in current mode
    if (msg.role === 'assistant') {
      processedContent = stripUnavailableToolCalls(processedContent, mode);
    }

    processedContent = appendOmittedImageAttachmentNote(processedContent, msg);

    // Build message with vision support if available
    const chatMessage = buildChatMessage(
      msg.role,
      processedContent,
      undefined,
      modelSupportsVision
    );
    result.push(chatMessage);

    // Add tool results for this message
    if (msg.toolExecutions && msg.toolExecutions.size > 0) {
      const toolResults = formatToolResultsForHistory(msg.toolExecutions, mode);
      if (toolResults.length > 0) {
        result.push({
          role: 'user',
          content: `<previous_tool_results>\n${toolResults.join('\n\n---\n\n')}\n</previous_tool_results>`,
        });
      }
    }
  }

  return result;
}