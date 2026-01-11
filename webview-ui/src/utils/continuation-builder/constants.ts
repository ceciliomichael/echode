/**
 * Context Management Constants
 * Based on proven patterns from production AI coding assistants
 */

/** Maximum conversation turns to keep */
export const MAX_HISTORY_MESSAGES = 20;

/** Max chars for diagnostics */
export const MAX_DIAGNOSTICS_CHARS = 4000;

/** Always keep last N messages (like KiloCode's N=3) */
export const N_MESSAGES_TO_ALWAYS_KEEP = 4;

/**
 * Context truncation notice - shown when older messages are removed
 */
export const CONTEXT_TRUNCATION_NOTICE =
  `[NOTE] Some previous conversation history has been removed to maintain optimal context window length. ` +
  `The initial user task and the most recent exchanges have been retained for continuity.`;

/**
 * Continuation instruction appended to tool results
 * Makes it clear that tools have completed and AI should proceed to next step
 */
export const CONTINUATION_INSTRUCTION = '[Tool execution complete. Proceed with the next step. Do not re-verify completed actions.]';