/**
 * Main continuation history builder
 * 
 * Builds chat history for the AI continuation loop.
 * Strategy: keep ALL messages, compress old tool results, keep recent ones full.
 * No truncation, no dropped messages, no confusing notices.
 */

import type { Message, ImageAttachment } from '../../types/chat';
import type { ChatMessage } from '../../types/chat-api';
import type { WorkspaceContext } from '../../types/workspace';
import type { ChatMode } from '../../types/chat-mode';
import { getSystemPrompt } from '../prompts';
import { getCurrentModel, isVisionCapableModel, buildChatMessage } from '../vision-utils';

import { buildToolResultMessage } from './tool-result-message-builder';
import { processAllMessages } from './message-processor';
import { injectCodeQualityReminder } from '../code-quality-reminder';
import { removeThinkBlocks } from '../think-block-parser';
import { mergeConsecutiveSameRoleMessages } from '../chat-history-utils';

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
  toolResultAttachments?: ImageAttachment[],
  extraModifiedPaths?: Set<string>
): ChatMessage[] {
  const currentModel = getCurrentModel();
  const modelSupportsVision = isVisionCapableModel(currentModel);
  const systemPrompt = getSystemPrompt(workspace, mode);

  const continuationHistory: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Process all conversation messages with compressed old tool results
  // Pass extraModifiedPaths so stale detection works even if React state hasn't flushed yet
  const processedMessages = processAllMessages(currentMessages, mode, modelSupportsVision, extraModifiedPaths);
  continuationHistory.push(...processedMessages);

  // Add user message if first iteration and not already in history
  if (isFirstIteration) {
    const userMessageAlreadyExists = currentMessages.some(
      msg => msg.role === 'user' && msg.content === userContent
    );
    if (!userMessageAlreadyExists) {
      continuationHistory.push(
        buildChatMessage('user', userContent, userAttachments, modelSupportsVision)
      );
    }
  }

  // Add current assistant response (contains tool calls)
  // Strip think blocks so the model reasons fresh
  continuationHistory.push({
    role: 'assistant',
    content: removeThinkBlocks(assistantContent),
  });

  // Add current tool result (the one we just executed)
  const toolResultMessageContent = buildToolResultMessage({
    toolResultText,
    diagnosticsText,
  });
  continuationHistory.push(
    buildChatMessage('user', toolResultMessageContent, toolResultAttachments, modelSupportsVision)
  );

  return injectCodeQualityReminder(mergeConsecutiveSameRoleMessages(continuationHistory), mode);
}