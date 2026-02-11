import type { Message, ImageAttachment } from '../../types/chat';
import type { ChatMessage } from '../../types/chat-api';
import { injectCodeQualityReminder } from '../../utils/code-quality-reminder';
import type { ChatHistoryContext } from './types';
import type { ToolExecutionState } from '../../types/tool';
import { buildChatMessage } from '../../utils/vision-utils';
import { formatToolExecutionResults } from './tool-result-formatter';
import { stripUnavailableToolCalls } from '../../utils/tool-history-filter';
import { removeThinkBlocks } from '../../utils/think-block-parser';
import { identifyStaleFileReads, identifyStaleFilePaths } from '../../utils/file-read-deduplicator';
import { TOOL_OUTPUT_PREFIX, RECENT_TURNS_FULL_RESULTS } from '../../utils/continuation-builder/constants';
import { mergeConsecutiveSameRoleMessages } from '../../utils/chat-history-utils';

function appendOmittedImageAttachmentNote(content: string, attachments?: ImageAttachment[]): string {
  if (!attachments || attachments.length === 0) {
    return content;
  }
  return `${content}\n[Image attachments: ${attachments.length} omitted from context]`;
}

/**
 * Compress tool executions into 1-line summaries for older turns.
 */
function compressToolExecutions(toolExecutions: Map<string, ToolExecutionState>): string {
  const lines: string[] = [];
  toolExecutions.forEach((execution) => {
    const data = execution.result?.data as Record<string, unknown> | undefined;
    if (!execution.result?.success) {
      lines.push(`[${execution.toolName}] ERROR`);
      return;
    }
    switch (execution.toolName) {
      case 'read_file':
        lines.push(`[read_file] ${data?.path || '?'}`);
        break;
      case 'edit': {
        const action = data?.action as string || 'applied';
        lines.push(`[edit] ${data?.path || '?'} → ${action === 'no_change' ? 'NO CHANGES' : 'APPLIED'}`);
        break;
      }
      case 'write_to_file': {
        const action = data?.action as string || 'modified';
        lines.push(`[write_to_file] ${data?.path || '?'} → ${action === 'created' ? 'CREATED' : action === 'no_change' ? 'NO CHANGES' : 'MODIFIED'}`);
        break;
      }
      case 'grep_search':
        lines.push(`[grep_search] "${data?.query || '?'}"`);
        break;
      default:
        lines.push(`[${execution.toolName}] done`);
    }
  });
  return lines.join('\n');
}

/**
 * Get indices of messages that have tool executions.
 */
function getToolTurnIndices(messages: Message[]): number[] {
  const indices: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].toolExecutions && messages[i].toolExecutions!.size > 0) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Build chat history with system prompt, context messages, tool results, and final user message.
 * 
 * Strategy: ALL messages stay in history (no truncation).
 * Only the last RECENT_TURNS_FULL_RESULTS tool turns keep full results.
 * Older turns get compressed to 1-line summaries.
 */
export function buildChatHistoryWithToolResults(ctx: ChatHistoryContext): ChatMessage[] {
  const {
    systemPrompt,
    contextMessages,
    content,
    attachments,
    modelSupportsVision,
    mode,
  } = ctx;

  // Identify stale file reads BEFORE building history
  const staleExecutionIds = identifyStaleFileReads(contextMessages);
  const stalePathsByExecution = identifyStaleFilePaths(contextMessages);

  // Check if we have an existing system message in the context (e.g. for sub-agents)
  const existingSystemMsg = contextMessages.find(m => m.role === 'system');
  
  const chatHistory: ChatMessage[] = [];
  
  if (!existingSystemMsg) {
    chatHistory.push({
      role: 'system',
      content: systemPrompt,
    });
  }

  // Determine which tool turns are "recent" (keep full results)
  const toolTurnIndices = getToolTurnIndices(contextMessages);
  const recentToolTurnStart = toolTurnIndices.length > RECENT_TURNS_FULL_RESULTS
    ? toolTurnIndices[toolTurnIndices.length - RECENT_TURNS_FULL_RESULTS]
    : 0;

  // Add messages with tool results embedded
  for (let i = 0; i < contextMessages.length; i++) {
    const msg = contextMessages[i];

    // Special handling for system messages
    if (msg.role === 'system') {
      if (msg === existingSystemMsg) {
        chatHistory.push({
          role: 'system',
          content: msg.content
        });
      }
      continue;
    }

    // Skip hidden messages
    if (msg.hidden) { continue; }

    let processedContent = msg.content;

    if (msg.role === 'assistant') {
      processedContent = removeThinkBlocks(processedContent);
      processedContent = stripUnavailableToolCalls(processedContent, mode);
    }

    const contentWithAttachmentNote = appendOmittedImageAttachmentNote(processedContent, msg.attachments);

    const chatMessage = buildChatMessage(
      msg.role,
      contentWithAttachmentNote,
      undefined,
      modelSupportsVision
    );
    chatHistory.push(chatMessage);

    // Add tool results for this message
    if (msg.toolExecutions && msg.toolExecutions.size > 0) {
      const isRecentTurn = i >= recentToolTurnStart;

      if (isRecentTurn) {
        // Full tool results for recent turns (with stale detection)
        const { toolResults } = formatToolExecutionResults(
          msg.toolExecutions,
          mode,
          staleExecutionIds,
          stalePathsByExecution
        );
        if (toolResults.length > 0) {
          chatHistory.push({
            role: 'user',
            content: `${TOOL_OUTPUT_PREFIX}\n<tool_results>\n${toolResults.join('\n\n---\n\n')}\n</tool_results>`,
          });
        }
      } else {
        // Compressed 1-line summaries for older turns
        const compressed = compressToolExecutions(msg.toolExecutions);
        if (compressed) {
          chatHistory.push({
            role: 'user',
            content: `<tool_results_summary>\n${compressed}\n</tool_results_summary>`,
          });
        }
      }
    }
  }

  // Add current user message
  const finalUserMessage = buildChatMessage(
    'user',
    content,
    attachments,
    modelSupportsVision
  );
  chatHistory.push(finalUserMessage);

  return injectCodeQualityReminder(mergeConsecutiveSameRoleMessages(chatHistory), mode);
}

