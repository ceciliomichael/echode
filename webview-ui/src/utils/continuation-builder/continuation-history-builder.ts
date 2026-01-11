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

  // Only add user message if it doesn't already exist anywhere in currentMessages
  // This prevents duplication - the user message is typically the FIRST message, not the last
  const userMessageAlreadyExists = currentMessages.some(
    msg => msg.role === 'user' && msg.content === userContent
  );

  if (isFirstIteration && !userMessageAlreadyExists) {
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

  const history = buildNormalHistory(
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

  return injectCodeQualityReminder(history, mode);
}