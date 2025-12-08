import type { ChatMode } from '../types/chat-mode';
import { PLAN_MODE_TOOL_IDS, ASK_MODE_TOOL_IDS, GENERAL_MODE_TOOL_IDS } from '../lib/tool-config';

/**
 * Tools available in Plan mode only
 */
const PLAN_MODE_TOOLS = new Set<string>(PLAN_MODE_TOOL_IDS);

const ASK_MODE_TOOLS = new Set<string>(ASK_MODE_TOOL_IDS);

const GENERAL_MODE_TOOLS = new Set<string>(GENERAL_MODE_TOOL_IDS);

/**
 * Check if a tool is available in the given mode
 */
export function isToolAvailableInMode(toolName: string, mode: ChatMode): boolean {
  if (mode === 'chat') {
    return false; // Chat mode has no tools
  }
  if (mode === 'agent') {
    return true; // Agent mode has access to all tools
  }
  if (mode === 'plan') {
    return PLAN_MODE_TOOLS.has(toolName);
  }
  if (mode === 'general') {
    return GENERAL_MODE_TOOLS.has(toolName);
  }
  return ASK_MODE_TOOLS.has(toolName);
}

/**
 * Get list of tools that should be filtered out for a given mode.
 * These tools will have their XML stripped from conversation history
 * to prevent the AI from seeing them and thinking they're available.
 */
export function getFilteredToolsForMode(mode: ChatMode): string[] {
  if (mode === 'agent') { return []; }

  if (mode === 'chat') {
    // Chat mode has no tools - all tools are filtered
    return ['read_file', 'write_to_file', 'apply_diff', 'list_files', 'delete_file', 'grep_search', 'glob_search', 'echo_search', 'todo_write', 'todo_read', 'plan_navigator', 'plan_handoff', 'get_diagnostics', 'execute_command'];
  }

  if (mode === 'general') {
    // General mode has file ops but no search tools
    return ['grep_search', 'glob_search', 'echo_search', 'todo_write', 'todo_read', 'plan_navigator', 'plan_handoff', 'get_diagnostics', 'execute_command'];
  }

  if (mode === 'plan') {
    // Plan mode is read-only - filter ALL editing and command tools
    return ['write_to_file', 'apply_diff', 'delete_file', 'execute_command', 'get_diagnostics'];
  }

  if (mode === 'ask') {
    // Ask mode is read-only - filter ALL editing, command, and planning tools
    return ['write_to_file', 'apply_diff', 'delete_file', 'execute_command', 'get_diagnostics', 'todo_write', 'todo_read', 'plan_navigator', 'plan_handoff'];
  }

  // Default: filter editing tools
  return ['write_to_file', 'apply_diff', 'delete_file'];
}

/**
 * Remove tool call XML blocks for tools not available in the current mode.
 * This prevents the model from seeing <invoke name="write_to_file"> in history
 * and thinking it can use that tool in Plan/Ask mode.
 */
export function stripUnavailableToolCalls(content: string, mode: ChatMode): string {
  if (mode === 'agent') {
    // Agent mode has all tools, no stripping needed
    return content;
  }

  const unavailableTools = getFilteredToolsForMode(mode);
  if (unavailableTools.length === 0) {
    return content;
  }

  let result = content;

  // Build regex pattern to match <invoke name="toolName">...</invoke> for each unavailable tool
  for (const toolName of unavailableTools) {
    // Match complete invoke blocks: <invoke name="toolName">...</invoke>
    const invokePattern = new RegExp(
      `<invoke\\s+name=["']${toolName}["'][^>]*>[\\s\\S]*?</invoke>`,
      'gi'
    );
    result = result.replace(invokePattern, `[${toolName} call removed - not available in current mode]`);
  }

  // Also strip any <function_calls> blocks that are now empty or only contain removed tool placeholders
  // Match function_calls that only contain whitespace and/or our placeholder text
  const emptyFunctionCallsPattern = /<function_calls>\s*(\[[\w_]+\s+call removed[^\]]*\]\s*)*<\/function_calls>/gi;
  result = result.replace(emptyFunctionCallsPattern, '[Previous tool calls not available in current mode]');

  return result;
}
