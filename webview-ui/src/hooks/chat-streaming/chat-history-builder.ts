import type { Message } from '../../types/chat';
import type { ChatMessage } from '../../types/chat-api';
import { injectCodeQualityReminder } from '../../utils/code-quality-reminder';
import type { ChatHistoryContext } from './types';
import type { ToolExecutionState } from '../../types/tool';
import { removeThinkBlocks } from '../../utils/think-block-parser';
import { buildChatMessage } from '../../utils/vision-utils';
import { formatToolExecutionResults } from './tool-result-formatter';
import { trimHistory } from './helpers';
import { stripUnavailableToolCalls } from '../../utils/tool-history-filter';

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
 * Extract file paths that were edited by apply_diff or write_to_file in a message
 */
function extractEditedFiles(msg: Message): string[] {
  const editedFiles: string[] = [];

  if (msg.toolExecutions) {
    msg.toolExecutions.forEach((execution: ToolExecutionState) => {
      if ((execution.toolName === 'apply_diff' || execution.toolName === 'write_to_file')
        && execution.status === 'completed'
        && execution.result?.success) {
        const data = execution.result.data as Record<string, unknown>;
        const filePath = (data.path as string) || (data.absolutePath as string);
        if (filePath) {
          editedFiles.push(filePath);
        }
      }
    });
  }

  return editedFiles;
}

/**
 * Build a map indicating which files are edited in later messages for each message index.
 * This allows us to skip stale diagnostics from earlier edits.
 */
function buildFilesEditedLaterMap(messages: Message[]): Map<number, Set<string>> {
  const result = new Map<number, Set<string>>();

  // First, collect all edited files with their message indices
  const allEdits: { msgIndex: number; files: string[] }[] = [];
  for (let i = 0; i < messages.length; i++) {
    const files = extractEditedFiles(messages[i]);
    if (files.length > 0) {
      allEdits.push({ msgIndex: i, files });
    }
  }

  // For each message, compute which files are edited in LATER messages
  for (let i = 0; i < messages.length; i++) {
    const filesEditedLater = new Set<string>();
    for (const edit of allEdits) {
      if (edit.msgIndex > i) {
        for (const file of edit.files) {
          filesEditedLater.add(file);
        }
      }
    }
    result.set(i, filesEditedLater);
  }

  return result;
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

  // Build full chat history with all messages and tool results
  const chatHistory: ChatMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ];

  // Build map of which files are edited later for each message index
  // This allows us to skip stale diagnostics from earlier edits
  const filesEditedLaterMap = buildFilesEditedLaterMap(contextMessages);

  // Add messages with tool results embedded
  for (let msgIndex = 0; msgIndex < contextMessages.length; msgIndex++) {
    const msg = contextMessages[msgIndex];
    // Skip hidden messages
    if (msg.hidden) continue;

    // Strip <think> and <thinking> blocks from message content
    let processedContent = removeThinkBlocks(msg.content);

    // For assistant messages, strip tool call XML for tools not available in current mode
    if (msg.role === 'assistant') {
      processedContent = stripUnavailableToolCalls(processedContent, mode);
    }

    // Build message with vision support if available
    const chatMessage = buildChatMessage(
      msg.role,
      processedContent,
      msg.attachments,
      modelSupportsVision
    );
    chatHistory.push(chatMessage);

    // If this message has tool executions, add them as context
    if (msg.toolExecutions && msg.toolExecutions.size > 0) {
      // Pass the set of files that will be edited later to skip stale diagnostics
      const filesEditedLater = filesEditedLaterMap.get(msgIndex);
      const { toolResults } = formatToolExecutionResults(msg.toolExecutions, mode, filesEditedLater);

      if (toolResults.length > 0) {
        const toolResultsContent = `<tool_results>\n${toolResults.join('\n\n---\n\n')}\n</tool_results>`;
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

    // Only mention apply_diff-specific guidance in editing-capable modes
    if (mode === 'agent' || mode === 'general') {
      instruction += `\nFor apply_diff: copy SEARCH content exactly from <tool_results> above.`;
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

/**
 * Build minimal chat history for forced echo search (without tool results injection)
 */
export function buildMinimalChatHistory(
  systemPrompt: string,
  messagesToSend: Message[],
  content: string,
  attachments: import('../../types/chat').ImageAttachment[] | undefined,
  modelSupportsVision: boolean,
  mode: import('../../types/chat-mode').ChatMode = 'agent'
): ChatMessage[] {
  const chatHistory: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add previous messages
  for (const msg of messagesToSend) {
    let processedContent = removeThinkBlocks(msg.content);

    // For assistant messages, strip tool call XML for tools not available in current mode
    if (msg.role === 'assistant') {
      processedContent = stripUnavailableToolCalls(processedContent, mode);
    }

    const chatMessage = buildChatMessage(
      msg.role,
      processedContent,
      msg.attachments,
      modelSupportsVision
    );
    chatHistory.push(chatMessage);
  }

  // Add current user message
  const finalUserMessage = buildChatMessage(
    'user',
    content,
    attachments,
    modelSupportsVision
  );
  chatHistory.push(finalUserMessage);

  return injectCodeQualityReminder(chatHistory, mode);
}
