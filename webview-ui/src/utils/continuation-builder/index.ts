/**
 * Continuation Builder Module
 * Handles building chat history for AI tool execution continuation
 */

// Main exports
export { buildContinuationHistory } from './continuation-history-builder';
export { calculateContextTokens } from './token-estimator';
export { getDiagnosticsForToolResults } from './diagnostics-fetcher';

// Type exports
export type { TodoItem, ContinuationConfig, ToolResultMessageOptions } from './types';

// Constants (for advanced usage)
export {
  MAX_DIAGNOSTICS_CHARS,
  RECENT_TURNS_FULL_RESULTS,
  CONTINUATION_INSTRUCTION,
  TOOL_OUTPUT_PREFIX,
} from './constants';