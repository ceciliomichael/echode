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
import { injectCodeQualityReminder } from '../code-quality-reminder';

/**
 * Build compressed history when a summary message exists
 * Includes summary as context + recent messages + current conversation
 */
function buildCompressedHistory(
  systemPrompt: string,
  summaryMessage: Message,
  currentMessages: Message[],
  userContent: string,
  assistantContent: string,
  toolResultText: string,
  diagnosticsText: string,
  currentTodos: TodoItem[],
  mode: ChatMode,
  userAttachments: ImageAttachment[] | undefined,
  modelSupportsVision: boolean,
  isFirstIteration: boolean
): ChatMessage[] {
  console.log('[ContinuationHistory] Using compressed summary with recent context');

  const continuationHistory: ChatMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ];

  // Find the summary message index to get messages after it
  const summaryIndex = currentMessages.findIndex(msg => msg.id === summaryMessage.id);

  // Get the first message (original task) if it exists before the summary
  const firstMessage = currentMessages.find((msg, idx) =>
    idx < summaryIndex && msg.role === 'user' && !msg.hidden
  );

  // Build combined first message with summary context
  let combinedContent = '';
  if (firstMessage) {
    combinedContent = firstMessage.content;
  }

  // Add summary as context block
  const summaryBlock = `<previous_session_summary>\n${summaryMessage.content}\n</previous_session_summary>`;
  combinedContent = combinedContent
    ? `${combinedContent}\n\n${summaryBlock}`
    : summaryBlock;

  continuationHistory.push({
    role: 'user',
    content: combinedContent,
  });

  // Add assistant acknowledgment
  continuationHistory.push({
    role: 'assistant',
    content: 'Understood. Continuing from the previous session.',
  });

  // Add recent messages that come after the summary (preserved during compression)
  const recentMessages = currentMessages
    .slice(summaryIndex + 1)
    .filter(msg => !msg.hidden);

  for (const msg of recentMessages) {
    // Skip if same role as last message (shouldn't happen, but guard)
    const lastMsg = continuationHistory[continuationHistory.length - 1];
    if (lastMsg && lastMsg.role === msg.role) continue;

    const chatMessage = buildChatMessage(
      msg.role,
      msg.content,
      msg.attachments,
      modelSupportsVision
    );
    continuationHistory.push(chatMessage);
  }

  // Only add user message on first iteration - subsequent iterations have it in currentMessages
  if (isFirstIteration) {
    const lastMsg = continuationHistory[continuationHistory.length - 1];

    // Ensure proper alternation before adding user message
    if (lastMsg?.role === 'user') {
      continuationHistory.push({
        role: 'assistant',
        content: 'Continuing...',
      });
    }

    const currentUserMessage = buildChatMessage(
      'user',
      userContent,
      userAttachments,
      modelSupportsVision
    );
    continuationHistory.push(currentUserMessage);
  }

  // Always add assistant response (contains tool calls)
  continuationHistory.push({
    role: 'assistant',
    content: assistantContent,
  });

  // Build the tool result message
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
  modelSupportsVision: boolean,
  isFirstIteration: boolean
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

  // Only add user message on first iteration - subsequent iterations have it in currentMessages
  if (isFirstIteration) {
    const currentUserMessage = buildChatMessage(
      'user',
      userContent,
      userAttachments,
      modelSupportsVision
    );
    continuationHistory.push(currentUserMessage);
  }

  // Always add assistant response (contains tool calls)
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
  userAttachments?: ImageAttachment[],
  isFirstIteration: boolean = true
): ChatMessage[] {
  // Check if current model supports vision for image attachments
  const currentModel = getCurrentModel();
  const modelSupportsVision = isVisionCapableModel(currentModel);
  const systemPrompt = getSystemPrompt(workspace, mode);

  // Check if we have a compressed summary (hidden user message from compression)
  const summaryMessage = currentMessages.find(
    msg => msg.hidden && msg.id?.startsWith('compressed-summary-')
  );

  let history: ChatMessage[];

  if (summaryMessage) {
    // COMPRESSED CONTEXT: Include summary + recent messages + current conversation
    history = buildCompressedHistory(
      systemPrompt,
      summaryMessage,
      currentMessages,
      userContent,
      assistantContent,
      toolResultText,
      diagnosticsText,
      currentTodos,
      mode,
      userAttachments,
      modelSupportsVision,
      isFirstIteration
    );
  } else {
    // NORMAL FLOW: Full continuation history
    history = buildNormalHistory(
      systemPrompt,
      currentMessages,
      userContent,
      assistantContent,
      toolResultText,
      diagnosticsText,
      currentTodos,
      mode,
      userAttachments,
      modelSupportsVision,
      isFirstIteration
    );
  }

  return injectCodeQualityReminder(history, mode);
}