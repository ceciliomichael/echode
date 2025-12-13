/**
 * Centralized Parallel Tool Configuration
 * 
 * This is the SINGLE SOURCE OF TRUTH for which tools are allowed to run in parallel.
 * Only tools explicitly listed here can ever be parallelized.
 * All other tools MUST run serially, regardless of what the AI emits.
 */

/**
 * Tools that are explicitly allowed to run in parallel.
 * This is a strict allow-list - any tool NOT in this set will NEVER be parallelized.
 */
export const PARALLEL_ALLOWED_TOOLS = new Set<string>([
  'read_file',
  'grep_search',
  'glob_search',
  'list_files',
]);

/**
 * Check if a tool is allowed to run in parallel.
 * Returns true ONLY if the tool is explicitly in the allow-list.
 */
export function isParallelAllowed(toolName: string): boolean {
  return PARALLEL_ALLOWED_TOOLS.has(toolName);
}

/**
 * Check if ALL tools in a list are allowed to run in parallel.
 * Returns false if ANY tool is not in the allow-list.
 */
export function areAllToolsParallelAllowed(toolNames: string[]): boolean {
  return toolNames.every(name => PARALLEL_ALLOWED_TOOLS.has(name));
}
