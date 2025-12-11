import type { ForcedEchoSearchContext } from './types';
import { escapeXml } from './helpers';
import { buildMinimalChatHistory } from './chat-history-builder';

/**
 * Handle forced echo_search execution - bypasses LLM and executes echo_search directly
 * Returns the synthetic assistant content that was generated
 */
export async function handleForcedEchoSearch(ctx: ForcedEchoSearchContext): Promise<string> {
  const {
    content,
    attachments,
    systemPrompt,
    messagesToSend,
    assistantMessageId,
    modelSupportsVision,
    mode,
    setMessages,
    setIsExecutingTool,
    executeToolAndContinue,
  } = ctx;
  // Create synthetic assistant content with echo_search tool block
  // Must match the expected format: <function_calls><invoke name="tool">...
  // Escape XML special characters to prevent breaking the tool block structure
  const escapedContent = escapeXml(content);
  const syntheticToolBlock = `<function_calls>
<invoke name="echo_search">
<parameter name="query">${escapedContent}</parameter>
</invoke>
</function_calls>`;

  const assistantContent = syntheticToolBlock;

  // Update UI immediately with the tool block
  setMessages((prev) =>
    prev.map((msg) =>
      msg.id === assistantMessageId
        ? { ...msg, content: assistantContent }
        : msg
    )
  );

  // Set executing tool state immediately
  setIsExecutingTool(true);

  // Build minimal chat history for continuation after tool execution
  // Pass mode to ensure unavailable tool calls are stripped from history
  const chatHistory = buildMinimalChatHistory(
    systemPrompt,
    messagesToSend,
    content,
    attachments,
    modelSupportsVision,
    mode
  );

  // Execute tool directly and continue
  await executeToolAndContinue(
    assistantContent,
    assistantMessageId,
    chatHistory,
    messagesToSend,
    content,
    0,
    attachments
  );

  return assistantContent;
}
