/**
 * Tool Configuration
 *
 * Defines which tools are available for each chat mode and generates
 * the tool system prompt with available tools and format instructions.
 *
 * NOTE: Mode-specific tool instructions are in prompts/[mode]/tools/
 * This file only handles generic XML format and tool filtering.
 */

import type { Tool } from '../types/tool';
import { getAllToolMetadata, getAllTools as getToolsFromRegistry } from './tool-registry';
import type { ChatMode } from '../types/chat-mode';

// ============================================================================
// MODE-SPECIFIC TOOL SETS
// ============================================================================

/** All available tools (used for Agent mode) */
export const AVAILABLE_TOOLS: Tool[] = getToolsFromRegistry(false);

/** Plan mode: exploration + planning tools only */
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

/** Ask mode: read-only exploration tools */
export const ASK_MODE_TOOL_IDS = [
  'read_file',
  'list_files',
  'grep_search',
  'glob_search',
  'echo_search',
] as const;

/** General mode: file operations (no code search) */
export const GENERAL_MODE_TOOL_IDS = [
  'read_file',
  'write_to_file',
  'apply_diff',
  'list_files',
  'delete_file',
] as const;

/** Tools exclusive to Plan mode (never shown in Agent/other modes) */
export const PLAN_ONLY_TOOL_IDS = new Set<string>([
  'plan_navigator',
  'plan_handoff',
]);

// ============================================================================
// TOOL RETRIEVAL FUNCTIONS
// ============================================================================

/** Get all registered tools */
export function getAllTools(defaultEnabled = true): Tool[] {
  return getToolsFromRegistry(defaultEnabled);
}

/**
 * Get tools filtered by chat mode
 */
export function getToolsForMode(mode: ChatMode, defaultEnabled = true): Tool[] {
  const allTools = getToolsFromRegistry(defaultEnabled);

  switch (mode) {
    case 'plan':
      return allTools.filter(t => (PLAN_MODE_TOOL_IDS as readonly string[]).includes(t.id));

    case 'ask':
      return allTools.filter(t => (ASK_MODE_TOOL_IDS as readonly string[]).includes(t.id));

    case 'general':
      return allTools.filter(t => (GENERAL_MODE_TOOL_IDS as readonly string[]).includes(t.id));

    case 'chat':
      return []; // No tools in chat mode

    case 'agent':
    default:
      // Agent mode: all tools except plan-only
      return allTools.filter(t => !PLAN_ONLY_TOOL_IDS.has(t.id));
  }
}

// ============================================================================
// TOOL SYSTEM PROMPT GENERATION
// ============================================================================

/**
 * Generate the tool system prompt with format instructions and available tools
 * NOTE: This is GENERIC - mode-specific instructions are in prompts/[mode]/tools/
 */

export function getToolSystemPrompt(enabledTools: Tool[]): string {
  if (enabledTools.length === 0) return '';

  const allMetadata = getAllToolMetadata();
  const toolIdsList = enabledTools.map(t => `\`${t.id}\``).join(', ');

  // Build minimal tool list (just names and basic description)
  const toolList = enabledTools
    .map((tool) => {
      const metadata = allMetadata.find((m) => m.id === tool.id);
      if (!metadata) return '';
      return `- ${metadata.id}: ${metadata.description}`;
    })
    .filter(Boolean)
    .join('\n');

  return `<tools>
<tool_format>
CRITICAL: You must strictly follow this XML structure. Valid XML is required.

<function_calls>
    <invoke name="TOOL_NAME">
        <parameter name="param1">value1</parameter>
        <parameter name="param2">value2</parameter>
    </invoke>
</function_calls>

FORMAT RULES:
1. The root element must be <function_calls>.
2. Each tool call must be inside an <invoke> tag.
3. Parameters must be strictly inside <parameter> tags.
4. XML tags must be properly closed.
</tool_format>

<available_tools>
Available: ${toolIdsList}
Only use tools listed above.

${toolList}
</available_tools>
</tools>`;
}
