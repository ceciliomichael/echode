import type { ChatMode } from '../types/chat-mode';
import { PLAN_MODE_TOOL_IDS, ASK_MODE_TOOL_IDS, GENERAL_MODE_TOOL_IDS } from '../lib/tool-config';

/**
 * Set of all standard built-in tools that we might want to filter.
 * Mirrors STANDARD_TOOL_IDS in tool-config.ts
 */
const STANDARD_TOOLS = [
  'read_file',
  'write_to_file',
  'list_files',
  'grep_search',
  'glob_search',
  'delete_file',
  'todo_write',
  'todo_read',
  'apply_diff',
  'get_diagnostics',
  'echo_search',
  'plan',
];

/**
 * Check if a tool is available in the given mode
 */
export function isToolAvailableInMode(toolName: string, mode: ChatMode): boolean {
  const filtered = getFilteredToolsForMode(mode);
  return !filtered.includes(toolName);
}

/**
 * Get list of tools that should be filtered out for a given mode.
 * These tools will have their XML stripped from conversation history
 * to prevent the AI from seeing them and thinking they're available.
 */
export function getFilteredToolsForMode(mode: ChatMode): string[] {
  let allowedTools: Set<string>;

  switch (mode) {
    case 'plan':
      allowedTools = new Set(PLAN_MODE_TOOL_IDS);
      break;
    case 'ask':
      allowedTools = new Set(ASK_MODE_TOOL_IDS);
      break;
    case 'general':
      allowedTools = new Set(GENERAL_MODE_TOOL_IDS);
      break;
    case 'agent':
      // Agent mode has all tools EXCEPT plan
      // We explicitly exclude 'plan' to prevent the agent from trying to manage the plan lifecycle
      allowedTools = new Set(STANDARD_TOOLS.filter(t => t !== 'plan'));
      break;
    case 'chat':
    default:
      // Chat mode has no standard tools (only MCP tools, which we don't filter here)
      allowedTools = new Set([]);
      break;
  }

  // Return all standard tools that are NOT in the allowed set
  return STANDARD_TOOLS.filter(tool => !allowedTools.has(tool));
}

/**
 * Remove tool call XML blocks for tools not available in the current mode.
 * This prevents the model from seeing <invoke name="write_to_file"> in history
 * and thinking it can use that tool in Plan/Ask mode.
 */
export function stripUnavailableToolCalls(content: string, mode: ChatMode): string {
  // Get list of tools to strip for this mode
  const unavailableTools = getFilteredToolsForMode(mode);
  
  if (unavailableTools.length === 0) {
    return content;
  }

  let result = content;

  // Build regex pattern to match <invoke name="toolName">...</invoke> for each unavailable tool
  for (const toolName of unavailableTools) {
    // Match complete invoke blocks: <invoke name="toolName">...</invoke>
    // Handles attributes and multiline content
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