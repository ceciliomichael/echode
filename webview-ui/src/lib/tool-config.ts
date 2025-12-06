import type { Tool } from '../types/tool';
import { getAllToolMetadata, getAllTools as getToolsFromRegistry } from './tool-registry';
import type { ChatMode } from '../types/chat-mode';

export const AVAILABLE_TOOLS: Tool[] = getToolsFromRegistry(false);

// Fixed exploration-only tools for Plan mode
export const PLAN_MODE_TOOL_IDS = [
  'read_file',
  'list_files',
  'grep_search',
  'glob_search',
  'echo_search',
  'todo_write',
  'todo_read',
  'plan_navigator',
  'plan_handoff',
] as const;

export const ASK_MODE_TOOL_IDS = [
  'read_file',
  'list_files',
  'grep_search',
  'glob_search',
  'echo_search',
] as const;

// General mode: file operations only (no code-specific search tools)
export const GENERAL_MODE_TOOL_IDS = [
  'read_file',
  'write_to_file',
  'apply_diff',
  'list_files',
  'delete_file',
] as const;

// Plan-exclusive helpers should never be surfaced outside of Plan mode
export const PLAN_ONLY_TOOL_IDS = new Set<string>([
  'plan_navigator',
  'plan_handoff',
]);

// Re-export getAllTools for external use
export function getAllTools(defaultEnabled = true): Tool[] {
  return getToolsFromRegistry(defaultEnabled);
}

/**
 * Get tools filtered by chat mode
 * - Agent mode: uses all enabled tools from settings
 * - Plan mode: fixed 7 tools (read_file, list_files, grep_search, glob_search, todo_write, plan_navigator, plan_handoff)
 */
export function getToolsForMode(mode: ChatMode, defaultEnabled = true): Tool[] {
  const allTools = getToolsFromRegistry(defaultEnabled);

  if (mode === 'plan') {
    // Plan mode: filter to exploration tools only
    return allTools.filter(tool => (PLAN_MODE_TOOL_IDS as readonly string[]).includes(tool.id));
  }

  if (mode === 'ask') {
    // Ask mode: fixed read-only tools including echo_search
    return allTools.filter(tool =>
      (ASK_MODE_TOOL_IDS as readonly string[]).includes(tool.id)
    );
  }

  if (mode === 'general') {
    // General mode: file operations only for document-based workflows
    return allTools.filter(tool =>
      (GENERAL_MODE_TOOL_IDS as readonly string[]).includes(tool.id)
    );
  }

  // Agent mode: include all tools except plan-only helpers
  return allTools.filter(tool => !PLAN_ONLY_TOOL_IDS.has(tool.id));
}

export function getToolSystemPrompt(enabledTools: Tool[]): string {
  if (enabledTools.length === 0) { return ''; }

  const allMetadata = getAllToolMetadata();
  const toolIdsList = enabledTools.map(t => `\`${t.id}\``).join(', ');

  const toolDescriptions = enabledTools
    .map((tool) => {
      const metadata = allMetadata.find((m) => m.id === tool.id);
      if (!metadata) { return ''; }
      const promptDescription = tool.aiDescription || metadata.description;
      return `- **${metadata.id}**: ${promptDescription}\n  ${metadata.formatExample}`;
    })
    .filter(Boolean)
    .join('\n');

  return `<tools>
Format: <function_calls><invoke name="TOOL"><parameter name="param">value</parameter></invoke></function_calls>

Available: ${toolIdsList}

${toolDescriptions}
</tools>`;
}
