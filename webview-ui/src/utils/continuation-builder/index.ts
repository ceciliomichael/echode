/**
 * Continuation Builder Module
 * Handles building chat history for AI tool execution continuation
 */

// Main exports
export { buildContinuationHistory } from './continuation-history-builder';
export { buildTodoContext } from './todo-context-builder';
export { calculateContextTokens } from './token-estimator';

// Type exports
export type { TodoItem, ContinuationConfig, ToolResultMessageOptions, TruncationResult } from './types';

// Constants (for advanced usage)
export {
  MAX_HISTORY_MESSAGES,
  MAX_DIAGNOSTICS_CHARS,
  N_MESSAGES_TO_ALWAYS_KEEP,
  CONTEXT_TRUNCATION_NOTICE,
  CONTINUATION_INSTRUCTION,
} from './constants';