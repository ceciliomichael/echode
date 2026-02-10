/**
 * Main continuation history builder
 * Orchestrates the construction of chat history for AI continuation
 */

import type { Message, ImageAttachment } from '../../types/chat';
import type { ChatMessage } from '../../types/chat-api';
import type { WorkspaceContext } from '../../types/workspace';
import type { ChatMode } from '../../types/chat-mode';
import { CONTEXT_TRUNCATION_NOTICE } from './constants';
import { getSystemPrompt } from '../prompts';
import { getCurrentModel, isVisionCapableModel, buildChatMessage } from '../vision-utils';

import { buildToolResultMessage } from './tool-result-message-builder';
import { truncateMessageHistory, processFirstMessage, processRemainingMessages } from './message-processor';
import { injectCodeQualityReminder } from '../code-quality-reminder';
import { removeThinkBlocks } from '../think-block-parser';

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
  mode: ChatMode,
  userAttachments: ImageAttachment[] | undefined,
  toolResultAttachments: ImageAttachment[] | undefined,
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
  // Strip think blocks so the model reasons fresh without prior reasoning pollution
  continuationHistory.push({
    role: 'assistant',
    content: removeThinkBlocks(assistantContent),
  });

  // Build the tool result message in a structured format
  const toolResultMessageContent = buildToolResultMessage({
    toolResultText,
    diagnosticsText,
  });

  // If the tool produced images (e.g., read_file on an image), attach them as multimodal inputs.
  continuationHistory.push(
    buildChatMessage(
      'user',
      toolResultMessageContent,
      toolResultAttachments,
      modelSupportsVision
    )
  );

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
  mode: ChatMode = 'agent',
  userAttachments?: ImageAttachment[],
  isFirstIteration: boolean = true,
  toolResultAttachments?: ImageAttachment[]
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
    mode,
    userAttachments,
    toolResultAttachments,
    modelSupportsVision,
    isFirstIteration
  );

  return injectCodeQualityReminder(history, mode);
}