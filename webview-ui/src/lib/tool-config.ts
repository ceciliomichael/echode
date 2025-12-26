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
  'plan',
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

/** Review mode: read-only exploration + publish_findings (exclusive tool) */
export const REVIEW_MODE_TOOL_IDS = [
  'read_file',
  'list_files',
  'grep_search',
  'glob_search',
  'echo_search',
  'get_diagnostics',
  'publish_findings',
] as const;

/**
 * Set of all standard built-in tools.
 * Used to identify remote/MCP tools (which are not in this list).
 */
const STANDARD_TOOL_IDS = new Set([
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
  'publish_findings',
  'run_terminal',
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
    case 'yolo':
      // YOLO starts as Plan mode (same tools)
      // After handoff, it internally switches to Agent tools via lockedMode
      return allTools.filter(t =>
        (PLAN_MODE_TOOL_IDS as readonly string[]).includes(t.id) ||
        !STANDARD_TOOL_IDS.has(t.id)
      );

    case 'ask':
      // Ask mode: allowed exploration tools + MCP tools
      return allTools.filter(t =>
        (ASK_MODE_TOOL_IDS as readonly string[]).includes(t.id) ||
        !STANDARD_TOOL_IDS.has(t.id)
      );

    case 'general':
      // Include explicitly allowed general tools OR any remote/MCP tool (not in standard set)
      return allTools.filter(t =>
        (GENERAL_MODE_TOOL_IDS as readonly string[]).includes(t.id) ||
        !STANDARD_TOOL_IDS.has(t.id)
      );

    case 'chat':
      // Chat mode: MCP tools only (no standard tools)
      return allTools.filter(t => !STANDARD_TOOL_IDS.has(t.id));

    case 'review':
      // Review mode: exploration tools + publish_findings (exclusive to Review mode)
      // publish_findings is the mode-specific tool, similar to how 'plan' is exclusive to Plan mode
      return allTools.filter(t =>
        (REVIEW_MODE_TOOL_IDS as readonly string[]).includes(t.id) ||
        !STANDARD_TOOL_IDS.has(t.id)
      );

    case 'agent':
    default:
      // Agent mode: all tools EXCEPT plan and publish_findings (mode-exclusive tools)
      return allTools.filter(t => t.id !== 'plan' && t.id !== 'publish_findings');
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
  if (enabledTools.length === 0) { return ''; }

  const allMetadata = getAllToolMetadata();
  const toolIdsList = enabledTools.map(t => `\`${t.id}\``).join(', ');

  // Build minimal tool list (just names and basic description)
  const toolList = enabledTools
    .map((tool) => {
      const metadata = allMetadata.find((m) => m.id === tool.id);
      if (!metadata) { return ''; }
      return `- ${metadata.id}: ${metadata.description}`;
    })
    .filter(Boolean)
    .join('\n');

  return `<tools>
<tool_format>
CRITICAL: You must strictly follow this XML format structure. Valid XML is required.

SEQUENTIAL EXECUTION:
<function_calls>
    <invoke name="TOOL_NAME">
        <parameter name="param1">value1</parameter>
        <parameter name="param2">value2</parameter>
    </invoke>
</function_calls>

PARALLEL EXECUTION:
<function_calls>
    <invoke name="TOOL_NAME">
        <parameter name="param1">value1</parameter>
        <parameter name="param2">value2</parameter>
    </invoke>
    <invoke name="TOOL_NAME_2">
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

<invalid_formats>
CRITICAL: The following formats are STRICTLY FORBIDDEN. NEVER use them:

1. DO NOT use <tool_call> or <tool_code> tags.
2. DO NOT use <|tool|> or <|tool_call|> syntax.
3. DO NOT use [TOOL] or [call] prefixes.
4. DO NOT use JSON objects for tools (except inside param values).
5. DO NOT use Markdown code blocks for tools.

CORRECT FORMAT ONLY:
<function_calls>
    <invoke name="...">
        ...
    </invoke>
</function_calls>
</invalid_formats>

<available_tools>
Available: ${toolIdsList}
Only use tools listed above.

${toolList}
</available_tools>
</tools>`;
}
