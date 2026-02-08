import type { Message, ImageAttachment } from '../../types/chat';
import type { ChatMessage } from '../../types/chat-api';
import { injectCodeQualityReminder } from '../../utils/code-quality-reminder';
import type { ChatHistoryContext } from './types';
import type { ToolExecutionState } from '../../types/tool';
import { buildChatMessage } from '../../utils/vision-utils';
import { formatToolExecutionResults } from './tool-result-formatter';
import { trimHistory } from './helpers';
import { stripUnavailableToolCalls } from '../../utils/tool-history-filter';
import { identifyStaleFileReads, identifyStaleFilePaths } from '../../utils/file-read-deduplicator';
import { TOOL_OUTPUT_PREFIX } from '../../utils/continuation-builder/constants';

function appendOmittedImageAttachmentNote(content: string, attachments?: ImageAttachment[]): string {
  if (!attachments || attachments.length === 0) {
    return content;
  }
  return `${content}\n[Image attachments: ${attachments.length} omitted from context]`;
}

/**
 * Extract list of files read in the conversation for context
 */
function extractFilesRead(messages: Message[]): string[] {
  const filesRead: string[] = [];

  for (const msg of messages) {
    if (msg.toolExecutions) {
      msg.toolExecutions.forEach((execution: ToolExecutionState) => {
        if (execution.toolName === 'read_file' && execution.status === 'completed' && execution.result?.success) {
          const data = execution.result.data as Record<string, unknown>;
          if (data.path) {
            const rangeInfo = (data.startLine && data.endLine && (data.startLine !== 1 || data.endLine !== data.totalLines))
              ? ` [${data.startLine}-${data.endLine}]`
              : '';
            filesRead.push(`${data.path}${rangeInfo}`);
          }
        }
      });
    }
  }

  return filesRead;
}

/**
 * Build chat history with system prompt, context messages, tool results, and final user message
 * Returns the final chat history ready to send to the LLM
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
  // This ensures older reads of the same file are summarized, not shown in full
  const staleExecutionIds = identifyStaleFileReads(contextMessages);
  const stalePathsByExecution = identifyStaleFilePaths(contextMessages);

  // Check if we have an existing system message in the context (e.g. for sub-agents)
  const existingSystemMsg = contextMessages.find(m => m.role === 'system');
  
  // Initialize chat history
  // If we have an existing system message, use it (even if hidden). 
  // Otherwise, use the default systemPrompt.
  const chatHistory: ChatMessage[] = [];
  
  if (!existingSystemMsg) {
    chatHistory.push({
      role: 'system',
      content: systemPrompt,
    });
  }

  // Add messages with tool results embedded
  for (const msg of contextMessages) {
    // Special handling for system messages: 
    // If this is the system message we identified, add it (ignoring hidden flag)
    if (msg.role === 'system') {
      // Only add if it's the first one we found (to avoid duplicates if logic is complex)
      if (msg === existingSystemMsg) {
        chatHistory.push({
          role: 'system',
          content: msg.content
        });
      }
      continue;
    }

    // Skip hidden messages (except the system message handled above)
    if (msg.hidden) {continue;}

    // Keep reasoning blocks in message content to provide context for the AI
    // Only strip unavailable tool calls
    let processedContent = msg.content;

    // For assistant messages, strip tool call XML for tools not available in current mode
    if (msg.role === 'assistant') {
      processedContent = stripUnavailableToolCalls(processedContent, mode);
    }

    const contentWithAttachmentNote = appendOmittedImageAttachmentNote(processedContent, msg.attachments);

    // Build message with vision support if available
    const chatMessage = buildChatMessage(
      msg.role,
      contentWithAttachmentNote,
      undefined,
      modelSupportsVision
    );
    chatHistory.push(chatMessage);

    // If this message has tool executions, add them as context
    if (msg.toolExecutions && msg.toolExecutions.size > 0) {
      // Pass stale file info to formatter so outdated reads get summarized
      const { toolResults } = formatToolExecutionResults(
        msg.toolExecutions,
        mode,
        staleExecutionIds,
        stalePathsByExecution
      );

      if (toolResults.length > 0) {
        const toolResultsContent = `${TOOL_OUTPUT_PREFIX}\n<tool_results>\n${toolResults.join('\n\n---\n\n')}\n</tool_results>`;
        chatHistory.push({
          role: 'user',
          content: toolResultsContent,
        });
      }
    }
  }

  // Apply history trimming after assembling messages and tool results
  const trimmedHistory = trimHistory(chatHistory);

  // Add current user message with attachments
  const hasToolResults = contextMessages.some(msg => msg.toolExecutions && msg.toolExecutions.size > 0);
  const filesRead = extractFilesRead(contextMessages);

  // Build instruction based on context - concise and actionable
  let instruction = '';

  if (filesRead.length > 0) {
    instruction += `\n\n<session_state>\nFiles read: ${filesRead.slice(-10).join(', ')}${filesRead.length > 10 ? ` (+${filesRead.length - 10} more)` : ''}`;

    if (mode === 'agent' || mode === 'general') {
      instruction += `\nFor edit: copy old_string exactly from <tool_results> above.`;
    }

    instruction += `\n</session_state>`;
  }

  if (hasToolResults) {
    instruction += '\n[Use <tool_results> for exact content. Stay focused.]';
  }

  const finalUserMessage = buildChatMessage(
    'user',
    content + instruction,
    attachments,
    modelSupportsVision
  );
  trimmedHistory.push(finalUserMessage);

  return injectCodeQualityReminder(trimmedHistory, mode);
}

