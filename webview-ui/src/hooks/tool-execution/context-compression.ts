/**
 * Context Compression Module
 * 
 * Handles token estimation and context compression for tool execution continuations.
 * Uses the ContextCompressorService for lossless compression when context exceeds limits.
 */
import type { Message } from '../../types/chat';
import type { ChatMode } from '../../types/chat-mode';
import type { WorkspaceContext } from '../../types/workspace';
import { getContextCompressor } from '../../services/context-compressor';
import { storageService } from '../../utils/storage';
import { getSystemPrompt } from '../../utils/prompts';

/**
 * Estimate tokens from text (~4 chars per token)
 */
export function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.ceil(text.length / 4);
}

/**
 * Build context messages for continuation, applying lossless compression if needed.
 * 
 * This uses the ContextCompressorService for compression but keeps
 * compression local to the continuation (no React state coupling).
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

  // If compression isn't configured, just return original messages
  if (!contextSettings || !contextSettings.summarizerModel) {
    return messages;
  }

  const compressor = getContextCompressor(contextSettings);

  const systemPrompt = getSystemPrompt(workspace, mode);
  const systemPromptTokens = estimateTokens(systemPrompt);

  // Treat tool results + diagnostics as the new content added for this continuation
  const newContentTokens = estimateTokens(toolResultText) + estimateTokens(diagnosticsText);

  const analysis = compressor.analyzeContext(
    messages,
    systemPromptTokens,
    newContentTokens
  );

  if (!analysis.needsCompression || analysis.middleMessages.length === 0) {
    return messages;
  }

  console.log('[ContextCompression] Context compression triggered for continuation:', {
    estimatedTokens: analysis.estimatedTokens,
    firstMessages: analysis.firstMessages.length,
    middleMessages: analysis.middleMessages.length,
    recentMessages: analysis.recentMessages.length,
  });

  const summaryResult = await compressor.requestSummary(analysis.middleMessages);

  if (!summaryResult.success || !summaryResult.summary) {
    console.warn('[ContextCompression] Continuation context compression failed:', summaryResult.error);
    return messages;
  }

  const compressedMessages: Message[] = [];
  compressedMessages.push(...analysis.firstMessages);
  compressedMessages.push({
    id: `compressed-summary-${Date.now()}`,
    role: 'assistant',
    content: `[Context Summary]\n${summaryResult.summary}`,
    timestamp: new Date(),
  });
  compressedMessages.push(...analysis.recentMessages);

  console.log('[ContextCompression] Continuation context compressed:', {
    compressedCount: compressedMessages.length,
  });

  return compressedMessages;
}