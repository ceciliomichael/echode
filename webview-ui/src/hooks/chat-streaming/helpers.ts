import type { ChatMessage } from '../../types/chat-api';

export const MAX_HISTORY_MESSAGES = 20;
export const MAX_FILE_CONTENT_CHARS = 8000;

/**
 * Trim chat history to keep only the most recent messages while preserving system message
 */
export function trimHistory(history: ChatMessage[]): ChatMessage[] {
  if (history.length <= MAX_HISTORY_MESSAGES) {
    return history;
  }

  const [systemMessage, ...rest] = history;
  const kept = rest.slice(-Math.max(1, MAX_HISTORY_MESSAGES - 1));
  return [systemMessage, ...kept];
}

/**
 * Truncate content to a maximum character limit with indicator
 */
export function truncateContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }
  return `${content.slice(0, maxChars)}\n...[truncated file content]`;
}

/**
 * Escape XML special characters to prevent breaking tool block parsing
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Estimate token count for a string (rough approximation: 1 token ≈ 4 chars)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if an error message indicates a retryable transient error
 */
export function isRetryableError(errorMessage: string): boolean {
  const lowerError = errorMessage.toLowerCase();
  return (
    lowerError.includes('http') ||
    lowerError.includes('500') ||
    lowerError.includes('502') ||
    lowerError.includes('503') ||
    lowerError.includes('504') ||
    lowerError.includes('parse') ||
    lowerError.includes('json') ||
    lowerError.includes('service unavailable') ||
    lowerError.includes('econnreset') ||
    lowerError.includes('etimedout') ||
    lowerError.includes('econnrefused') ||
    lowerError.includes('network') ||
    lowerError.includes('fetch')
  );
}
