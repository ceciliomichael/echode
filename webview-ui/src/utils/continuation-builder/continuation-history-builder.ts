/**
 * Main continuation history builder
 * Orchestrates the construction of chat history for AI continuation
 */

import type { Message, ImageAttachment } from '../../types/chat';
import type { ChatMessage } from '../../types/chat-api';
import type { WorkspaceContext } from '../../types/workspace';
import type { ChatMode } from '../../types/chat-mode';
import type { TodoItem } from './types';
import { CONTEXT_TRUNCATION_NOTICE } from './constants';
import { getSystemPrompt } from '../prompts';
import { getCurrentModel, isVisionCapableModel, buildChatMessage } from '../vision-utils';
import { buildTodoContext } from './todo-context-builder';
import { buildToolResultMessage } from './tool-result-message-builder';
import { truncateMessageHistory, processFirstMessage, processRemainingMessages } from './message-processor';

/**
 * Build compressed history when a summary message exists
 * Starts fresh with summary prepended to tool results
 */
function buildCompressedHistory(
  systemPrompt: string,
  summaryMessage: Message,
  toolResultText: string,
  diagnosticsText: string,
  currentTodos: TodoItem[],
  mode: ChatMode
): ChatMessage[] {
  console.log('[ContinuationHistory] Using compressed summary - starting fresh');

  const continuationHistory: ChatMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ];

  // Build user message with summary prepended and tool results
  const summaryPrefix = `<previous_session_summary>\n${summaryMessage.content}\n</previous_session_summary>\n\n`;
  const todoContext = buildTodoContext(currentTodos, mode);

  const toolResultMessageContent = buildToolResultMessage({
    toolResultText,
    diagnosticsText,
    todoContext,
    summaryPrefix,
  });

  continuationHistory.push({
    role: 'user',
    content: toolResultMessageContent,
  });

  return continuationHistory;
}

/**
 * Build normal history with full message chain
 * Handles truncation for long conversations
 */
function buildNormalHistory(
  systemPrompt: string,
  currentMessages: Message[],
  userContent: string,
  assistantContent: string,
  toolResultText: string,
  diagnosticsText: string,
  currentTodos: TodoItem[],
  mode: ChatMode,
  userAttachments: ImageAttachment[] | undefined,
  modelSupportsVision: boolean
): ChatMessage[] {
  const continuationHistory: ChatMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ];

  // Context management: Keep first message + last N messages, with truncation notice if needed
  const { messages: messagesToInclude, wasTruncated } = truncateMessageHistory(currentMessages);

  // Add first message (original task context)
  if (messagesToInclude.length > 0) {
    const firstMsgResults = processFirstMessage(
      messagesToInclude[0],
      wasTruncated,
      mode,
      modelSupportsVision
    );
    continuationHistory.push(...firstMsgResults);
  }

  // If truncated, add a notice so the AI knows context was removed
  if (wasTruncated) {
    continuationHistory.push({
      role: 'user',
      content: CONTEXT_TRUNCATION_NOTICE,
    });
  }

  // Add remaining messages (skip first since we already added it)
  const remainingMsgResults = processRemainingMessages(
    messagesToInclude,
    mode,
    modelSupportsVision
  );
  continuationHistory.push(...remainingMsgResults);

  // Add current user message with attachments and assistant response
  const currentUserMessage = buildChatMessage(
    'user',
    userContent,
    userAttachments,
    modelSupportsVision
  );
  continuationHistory.push(currentUserMessage);
  continuationHistory.push({
    role: 'assistant',
    content: assistantContent,
  });

  // Build the tool result message in a structured format
  const todoContext = buildTodoContext(currentTodos, mode);
  const toolResultMessageContent = buildToolResultMessage({
    toolResultText,
    diagnosticsText,
    todoContext,
  });

  continuationHistory.push({
    role: 'user',
    content: toolResultMessageContent,
  });

  return continuationHistory;
}

/**
 * Build continuation history for AI tool execution loop
 * Handles both compressed (post-summary) and normal conversation flows
 */
export function buildContinuationHistory(
  workspace: WorkspaceContext,
  currentMessages: Message[],
  userContent: string,
  assistantContent: string,
  toolResultText: string,
  diagnosticsText: string,
  currentTodos: TodoItem[],
  mode: ChatMode = 'agent',
  userAttachments?: ImageAttachment[]
): ChatMessage[] {
  // Check if current model supports vision for image attachments
  const currentModel = getCurrentModel();
  const modelSupportsVision = isVisionCapableModel(currentModel);
  const systemPrompt = getSystemPrompt(workspace, mode);

  // Check if we have a compressed summary (hidden user message from compression)
  const summaryMessage = currentMessages.find(
    msg => msg.hidden && msg.id?.startsWith('compressed-summary-')
  );

  if (summaryMessage) {
    // COMPRESSED CONTEXT: Start fresh with summary prepended to tool results
    return buildCompressedHistory(
      systemPrompt,
      summaryMessage,
      toolResultText,
      diagnosticsText,
      currentTodos,
      mode
    );
  }

  // NORMAL FLOW: Full continuation history
  return buildNormalHistory(
    systemPrompt,
    currentMessages,
    userContent,
    assistantContent,
    toolResultText,
    diagnosticsText,
    currentTodos,
    mode,
    userAttachments,
    modelSupportsVision
  );
}