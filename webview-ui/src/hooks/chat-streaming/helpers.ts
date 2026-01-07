import type { ChatMessage } from '../../types/chat-api';
import type { Message } from '../../types/chat';

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
    lowerError.includes('streamingtimeouterror') ||
    lowerError.includes('no streaming data received within timeout') ||
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

/**
 * Detect the current YOLO mode phase by scanning history for plan tool executions.
 * 
 * YOLO mode has two phases:
 * - 'plan': Creating/updating the implementation plan
 * - 'agent': Executing the plan after handoff
 * 
 * We determine the phase by finding the most recent successful 'plan' tool execution:
 * - If mode is 'handoff' → we're in 'agent' phase
 * - If mode is 'create_plan' or 'update_plan' → we're in 'plan' phase
 * - If no plan tool found → default to 'plan' phase (fresh start)
 * 
 * This replaces the naive `lastAssistantMessage.mode === 'agent'` check which
 * incorrectly triggers agent phase when history contains non-YOLO agent messages
 * (e.g., from a previous Agent mode session or after compression).
 */
export function detectYoloPhase(messages: Message[]): 'plan' | 'agent' {
  // Scan messages in reverse order (most recent first)
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    
    // Only assistant messages have tool executions
    if (msg.role !== 'assistant' || !msg.toolExecutions) {
      continue;
    }
    
    // Check each tool execution in this message
    for (const execution of msg.toolExecutions.values()) {
      // Only consider successful 'plan' tool executions
      if (
        execution.toolName === 'plan' &&
        execution.status === 'completed' &&
        execution.result?.success
      ) {
        const planMode = execution.parameters?.mode as string | undefined;
        
        if (planMode === 'handoff') {
          // Found a handoff - we're in agent phase
          return 'agent';
        }
        
        if (planMode === 'create_plan' || planMode === 'update_plan') {
          // Found a plan creation/update - we're in plan phase
          // (either still planning, or plan was updated after handoff)
          return 'plan';
        }
      }
    }
  }
  
  // No plan tool found - default to plan phase (fresh YOLO start)
  return 'plan';
}
