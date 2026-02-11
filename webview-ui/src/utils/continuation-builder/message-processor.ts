/**
 * Message processing utilities for continuation history
 * 
 * Strategy: ALL messages stay in history (no truncation).
 * Only the last RECENT_TURNS_FULL_RESULTS turns keep full tool results.
 * Older turns get compressed to 1-line summaries per tool.
 * This prevents stale context confusion without losing conversation flow.
 */

import type { Message } from '../../types/chat';
import type { ChatMessage } from '../../types/chat-api';
import type { ChatMode } from '../../types/chat-mode';
import type { ToolExecutionState } from '../../types/tool';
import { RECENT_TURNS_FULL_RESULTS, TOOL_OUTPUT_PREFIX } from './constants';
import { buildChatMessage } from '../vision-utils';
import { stripDiagnosticsSections } from '../tool-context-cleaner';
import { stripUnavailableToolCalls } from '../tool-history-filter';
import { removeThinkBlocks } from '../think-block-parser';
import { formatToolResultsForHistory } from '../tool-result-formatter';
import { identifyStaleFilePaths } from '../file-read-deduplicator';

function appendOmittedImageAttachmentNote(content: string, msg: Message): string {
  if (!msg.attachments || msg.attachments.length === 0) {
    return content;
  }
  return `${content}\n[Image attachments: ${msg.attachments.length} omitted from context]`;
}

/**
 * Compress tool executions into 1-line summaries.
 * Used for older turns to save context space.
 */
function compressToolResults(toolExecutions: Map<string, ToolExecutionState>): string {
  const lines: string[] = [];

  toolExecutions.forEach((execution) => {
    const data = execution.result?.data as Record<string, unknown> | undefined;

    if (!execution.result?.success) {
      lines.push(`[${execution.toolName}] ERROR`);
      return;
    }

    switch (execution.toolName) {
      case 'read_file': {
        const path = data?.path as string || '?';
        lines.push(`[read_file] ${path}`);
        break;
      }
      case 'edit': {
        const path = data?.path as string || '?';
        const action = data?.action as string || 'applied';
        lines.push(`[edit] ${path} → ${action === 'no_change' ? 'NO CHANGES' : 'APPLIED'}`);
        break;
      }
      case 'write_to_file': {
        const path = data?.path as string || '?';
        const action = data?.action as string || 'modified';
        lines.push(`[write_to_file] ${path} → ${action === 'created' ? 'CREATED' : action === 'no_change' ? 'NO CHANGES' : 'MODIFIED'}`);
        break;
      }
      case 'grep_search': {
        const query = data?.query as string || '?';
        lines.push(`[grep_search] "${query}"`);
        break;
      }
      case 'list_files': {
        const path = data?.path as string || '?';
        lines.push(`[list_files] ${path}`);
        break;
      }
      case 'todo_write': {
        const allCompleted = data?.allCompleted === true;
        lines.push(`[todo_write] ${allCompleted ? 'ALL DONE' : 'updated'}`);
        break;
      }
      default:
        lines.push(`[${execution.toolName}] done`);
    }
  });

  return lines.join('\n');
}

/**
 * Count how many messages have tool executions (i.e., are "tool turns").
 * Returns indices of messages with tool executions, ordered.
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
 * Process all messages into chat history.
 * Recent tool turns get full results; older turns get compressed summaries.
 * No messages are dropped.
 */
export function processAllMessages(
  messages: Message[],
  mode: ChatMode,
  modelSupportsVision: boolean,
  extraModifiedPaths?: Set<string>
): ChatMessage[] {
  const result: ChatMessage[] = [];

  // Compute stale file paths across ALL messages so reads before edits get hidden
  const stalePathsByExecution = identifyStaleFilePaths(messages);
  const allStalePaths = new Set<string>();
  for (const paths of stalePathsByExecution.values()) {
    for (const p of paths) {
      allStalePaths.add(p);
    }
  }
  // Merge in extra modified paths from the current tool execution turn
  // These may not be in stored state yet due to React batching
  if (extraModifiedPaths) {
    for (const p of extraModifiedPaths) {
      allStalePaths.add(p);
    }
  }

  // Determine which tool turns are "recent" (keep full results)
  const toolTurnIndices = getToolTurnIndices(messages);
  const recentToolTurnStart = toolTurnIndices.length > RECENT_TURNS_FULL_RESULTS
    ? toolTurnIndices[toolTurnIndices.length - RECENT_TURNS_FULL_RESULTS]
    : 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Process message content
    let processedContent = msg.role === 'user'
      ? stripDiagnosticsSections(msg.content)
      : msg.content;

    if (msg.role === 'assistant') {
      processedContent = removeThinkBlocks(processedContent);
      processedContent = stripUnavailableToolCalls(processedContent, mode);
    }

    processedContent = appendOmittedImageAttachmentNote(processedContent, msg);

    const chatMessage = buildChatMessage(
      msg.role,
      processedContent,
      undefined,
      modelSupportsVision
    );
    result.push(chatMessage);

    // Add tool results for this message
    if (msg.toolExecutions && msg.toolExecutions.size > 0) {
      const isRecentTurn = i >= recentToolTurnStart;

      if (isRecentTurn) {
        // Full tool results for recent turns (with stale detection)
        const toolResults = formatToolResultsForHistory(msg.toolExecutions, mode, allStalePaths);
        if (toolResults.length > 0) {
          result.push({
            role: 'user',
            content: `${TOOL_OUTPUT_PREFIX}\n<tool_results>\n${toolResults.join('\n\n---\n\n')}\n</tool_results>`,
          });
        }
      } else {
        // Compressed 1-line summaries for older turns
        const compressed = compressToolResults(msg.toolExecutions);
        if (compressed) {
          result.push({
            role: 'user',
            content: `<tool_results_summary>\n${compressed}\n</tool_results_summary>`,
          });
        }
      }
    }
  }

  return result;
}