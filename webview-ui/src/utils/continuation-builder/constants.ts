/**
 * Context Management Constants
 * Based on proven patterns from production AI coding assistants
 */

/** Max chars for diagnostics */
export const MAX_DIAGNOSTICS_CHARS = 4000;

/**
 * Number of recent message turns that keep FULL tool results.
 * Older turns get compressed to 1-line summaries per tool.
 * This keeps context fresh without dropping messages.
 */
export const RECENT_TURNS_FULL_RESULTS = 4;

/**
 * Tool output prefix - prepended to tool result messages
 * Clearly marks system-generated content to prevent AI confusion with user messages
 */
export const TOOL_OUTPUT_PREFIX = '[SYSTEM TOOL OUTPUT]';

/**
 * Continuation instruction appended to tool results
 * Makes it clear that tools have completed and AI should proceed to next step
 */
export const CONTINUATION_INSTRUCTION = '[Tool execution complete. Continue with the next step. Do NOT re-read files you just edited — the edited region above shows the current file state. Do NOT retry tools that already succeeded — if you see "APPLIED" the change is confirmed in the file. Do NOT re-apply the same edit to the same file. Move on to the NEXT action.]';