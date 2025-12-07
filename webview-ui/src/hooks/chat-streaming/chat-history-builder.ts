import type { Message } from '../../types/chat';
import type { ChatMessage } from '../../types/chat-api';
import type { ChatHistoryContext } from './types';
import { removeThinkBlocks } from '../../utils/think-block-parser';
import { buildChatMessage } from '../../utils/vision-utils';
import { formatToolExecutionResults } from './tool-result-formatter';
import { trimHistory } from './helpers';

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
    const contentWithoutThinking = removeThinkBlocks(msg.content);

    // Build message with vision support if available
    const chatMessage = buildChatMessage(
      msg.role,
      contentWithoutThinking,
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

  // Build instruction based on context
  let instruction: string;
  if (hasToolResults) {
    instruction = '\n\n[INSTRUCTION: You have tool execution results in <tool_results>. Use them instead of guessing file contents. Follow your system prompt and tool rules. Respond concisely and stay focused on the coding task.]';
  } else {
    instruction = '\n\n[INSTRUCTION: Follow your system prompt and tool rules. Respond concisely and stay focused on the coding task.]';
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
  modelSupportsVision: boolean
): ChatMessage[] {
  const chatHistory: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add previous messages
  for (const msg of messagesToSend) {
    const contentWithoutThinking = removeThinkBlocks(msg.content);
    const chatMessage = buildChatMessage(
      msg.role,
      contentWithoutThinking,
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
