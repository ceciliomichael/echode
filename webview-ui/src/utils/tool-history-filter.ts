import type { ChatMode } from '../types/chat-mode';
import { PLAN_MODE_TOOL_IDS, ASK_MODE_TOOL_IDS } from '../lib/tool-config';

/**
 * Tools available in Plan mode only
 */
const PLAN_MODE_TOOLS = new Set<string>(PLAN_MODE_TOOL_IDS);

const ASK_MODE_TOOLS = new Set<string>(ASK_MODE_TOOL_IDS);

/**
 * Check if a tool is available in the given mode
 */
export function isToolAvailableInMode(toolName: string, mode: ChatMode): boolean {
  if (mode === 'agent') {
    return true; // Agent mode has access to all tools
  }
  if (mode === 'plan') {
    return PLAN_MODE_TOOLS.has(toolName);
  }
  return ASK_MODE_TOOLS.has(toolName);
}

/**
 * Get list of tools that should be filtered out in plan mode
 * Used to inform AI about unavailable history
 */
export function getFilteredToolsForMode(mode: ChatMode): string[] {
  if (mode === 'agent') return [];
  
  // Return list of agent-only tools that might appear in history
  return ['write_to_file', 'apply_diff', 'delete_file'];
}
