import type { Message } from '../../types/chat';
import type { WorkspaceContext } from '../../types/workspace';
import type { ChatMode } from '../../types/chat-mode';
import { getContextCompressor } from '../../services/context-compressor';
import { storageService } from '../../utils/storage';
import { getSystemPrompt } from '../../utils/prompts';

/**
 * Estimate token count from text (~4 chars per token)
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Build context messages for tool execution continuation.
 * 
 * This function checks if compression is needed and either:
 * - Returns the original messages if no compression needed
 * - Returns a compressed version with a summary message
 * 
 * NEW APPROACH: When compression is needed, we summarize the ENTIRE conversation
 * and return a single hidden message. The continuation-builder will detect this
 * and handle it appropriately.
 */
export async function buildCompressedContextIfNeeded(
  workspace: WorkspaceContext,
  messages: Message[],
  toolResultText: string,
  diagnosticsText: string,
  mode: ChatMode
): Promise<Message[]> {
  const settings = storageService.getSettings();
  const contextSettings = settings.contextSettings;

  // Calculate system prompt tokens
  const systemPrompt = getSystemPrompt(workspace, mode);
  const systemPromptTokens = estimateTokens(systemPrompt);

  // Estimate tokens for tool results
  const toolResultTokens = estimateTokens(toolResultText) + estimateTokens(diagnosticsText);

  const compressor = getContextCompressor(contextSettings);
  const analysis = compressor.analyzeContext(messages, systemPromptTokens, toolResultTokens);

  if (!analysis.needsCompression) {
    // No compression needed - return original messages
    return messages;
  }

  // Need at least some messages to compress
  if (messages.length < 2) {
    return messages;
  }

  console.log('[ToolExecution] Compression needed - summarizing entire conversation');

  // Summarize the ENTIRE conversation
  const summaryResult = await compressor.requestSummary(messages);

  if (!summaryResult.success || !summaryResult.summary) {
    console.error('[ToolExecution] Failed to generate summary:', summaryResult.error);
    return messages; // Fall back to original
  }

  // Return a single hidden summary message
  // The continuation-builder will detect this and prepend it to user message
  const compressedMessages: Message[] = [
    {
      id: `compressed-summary-${Date.now()}`,
      role: 'user',
      content: summaryResult.summary,
      timestamp: new Date(),
      hidden: true, // Hidden - will be prepended to user message
    },
  ];

  console.log('[ToolExecution] Compression complete - returning summary message');
  return compressedMessages;
}