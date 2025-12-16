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
 * Build chat history with system prompt, context messages, tool results, and final user message
 * Returns the final chat history ready to send to the LLM
 * 
 * NEW: If contextMessages contains a hidden summary message (from compression),
 * we prepend that summary to the user's message for a fresh start with context.
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

  // Check if we have a compressed summary (hidden user message with summary content)
  const summaryMessage = contextMessages.find(msg => msg.hidden && msg.id?.startsWith('compressed-summary-'));

  if (summaryMessage) {
    // COMPRESSED CONTEXT: Include summary + recent messages that were preserved
    console.log('[ChatHistory] Using compressed summary with recent context');

    const chatHistory: ChatMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ];

    // Find the index of the summary message
    const summaryIndex = contextMessages.findIndex(msg => msg.id === summaryMessage.id);

    // Get the first message (original context) if it exists before the summary
    const firstMessage = contextMessages.find((msg, idx) =>
      idx < summaryIndex && msg.role === 'user' && !msg.hidden
    );

    // FIXED: Combine first message + summary into a single user message to avoid consecutive user messages
    let combinedUserContent = '';

    if (firstMessage) {
      combinedUserContent = firstMessage.content;
    }

    // Add the summary as part of the combined message
    const summaryBlock = `<previous_session_summary>\n${summaryMessage.content}\n</previous_session_summary>`;
    combinedUserContent = combinedUserContent
      ? `${combinedUserContent}\n\n${summaryBlock}`
      : summaryBlock;

    // Build combined user message with first message's attachments if any
    const combinedUserMessage = buildChatMessage(
      'user',
      combinedUserContent,
      firstMessage?.attachments,
      modelSupportsVision
    );
    chatHistory.push(combinedUserMessage);

    // FIXED: Add assistant acknowledgment to maintain proper role alternation (user → assistant)
    chatHistory.push({
      role: 'assistant',
      content: 'I understand the context from the previous session. I\'ll continue from where we left off.',
    });

    // Add recent messages that come after the summary (preserved during compression)
    const recentMessages = contextMessages.slice(summaryIndex + 1).filter(msg => !msg.hidden);

    // Track last role to avoid consecutive same-role messages
    let lastRole: 'user' | 'assistant' = 'assistant';

    for (const msg of recentMessages) {
      // Skip system messages (shouldn't be in recentMessages, but guard anyway)
      if (msg.role === 'system') continue;

      let processedContent = removeThinkBlocks(msg.content);

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
      lastRole = msg.role as 'user' | 'assistant';

      // Include tool results for recent messages
      if (msg.toolExecutions && msg.toolExecutions.size > 0) {
        const { toolResults } = formatToolExecutionResults(msg.toolExecutions, mode);

        if (toolResults.length > 0) {
          const toolResultsContent = `<tool_results>\n${toolResults.join('\n\n---\n\n')}\n</tool_results>`;
          chatHistory.push({
            role: 'user',
            content: toolResultsContent,
          });
          lastRole = 'user';
        }
      }
    }

    // FIXED: Ensure proper alternation before final user message
    // If last message was user (from tool results), add assistant acknowledgment
    if (lastRole === 'user') {
      chatHistory.push({
        role: 'assistant',
        content: 'Understood. Processing the tool results.',
      });
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

  // NORMAL FLOW: Build full chat history with all messages and tool results
  const chatHistory: ChatMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ];

  // Add messages with tool results embedded
  for (const msg of contextMessages) {
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
