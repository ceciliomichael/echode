import type { Message } from '../../types/chat';
import type { ChatMessage } from '../../types/chat-api';
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
 * Build chat history with system prompt, context messages, tool results, and final user message
 * Returns the final chat history ready to send to the LLM
 */
export function buildChatHistoryWithToolResults(ctx: ChatHistoryContext): ChatMessage[] {
  const {
    systemPrompt,
    contextMessages,
    messagesToSend,
    content,
    attachments,
    modelSupportsVision,
    mode,
  } = ctx;

  // Build chat history with system prompt + all messages + tool results
  // Use contextMessages (potentially summarized) for LLM context
  const chatHistory: ChatMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ];

  // Add messages with tool results embedded
  // contextMessages may be summarized (first + summary + last N) or original messages
  for (const msg of contextMessages) {
    // Strip <think> and <thinking> blocks from message content before adding to chat history
    let processedContent = removeThinkBlocks(msg.content);
    
    // For assistant messages, also strip tool call XML for tools not available in current mode
    // This prevents Plan/Ask mode from seeing <invoke name="write_to_file"> in history
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
    // Filter to only include tools available in current mode
    if (msg.toolExecutions && msg.toolExecutions.size > 0) {
      const { toolResults } = formatToolExecutionResults(msg.toolExecutions, mode);

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
  const hasToolResults = messagesToSend.some(msg => msg.toolExecutions && msg.toolExecutions.size > 0);
  const filesRead = extractFilesRead(contextMessages);

  // Build instruction based on context - concise and actionable
  let instruction = '';
  
  if (filesRead.length > 0) {
    instruction += `\n\n<session_state>\nFiles read: ${filesRead.slice(-10).join(', ')}${filesRead.length > 10 ? ` (+${filesRead.length - 10} more)` : ''}\nFor apply_diff: copy SEARCH content exactly from <tool_results> above.\n</session_state>`;
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

  return trimmedHistory;
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

  return chatHistory;
}
