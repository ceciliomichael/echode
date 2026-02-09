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
import { getMcpUsageRules } from '../prompts/shared/mcp-usage-rules';
import { TOOL_XML_NAMESPACE } from './tool-xml';
import { getToolFormatKind } from './tool-format-policy';

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
  'todo_write',
  'plan',
] as const;

/** Ask mode: read-only exploration tools */
export const ASK_MODE_TOOL_IDS = [
  'read_file',
  'list_files',
  'grep_search',
  'glob_search',
] as const;

/** General mode: file operations (no code search) */
export const GENERAL_MODE_TOOL_IDS = [
  'read_file',
  'write_to_file',
  'edit',
  'list_files',
  'delete',
] as const;

/** Review mode: read-only exploration + publish_findings (exclusive tool) */
export const REVIEW_MODE_TOOL_IDS = [
  'read_file',
  'list_files',
  'grep_search',
  'glob_search',
  'get_diagnostics',
  'publish_findings',
] as const;

/** Sub-agent mode: core file tools. (Dynamic restrictions applied at runtime) */
export const SUB_AGENT_MODE_TOOL_IDS = [
  'read_file',
  'write_to_file',
  'list_files',
  'grep_search',
  'glob_search',
  'delete',
  'todo_write',
  'edit',
  'get_diagnostics',
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
  'delete',
  'todo_write',
  'edit',
  'get_diagnostics',
  'plan',
  'publish_findings',
  'run_terminal',
  'create_subagent',
  'use_subagent',
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
      // Chat mode: NO tools at all (pure conversation)
      return [];

    case 'review':
      // Review mode: exploration tools + publish_findings (exclusive to Review mode)
      // publish_findings is the mode-specific tool, similar to how 'plan' is exclusive to Plan mode
      return allTools.filter(t =>
        (REVIEW_MODE_TOOL_IDS as readonly string[]).includes(t.id) ||
        !STANDARD_TOOL_IDS.has(t.id)
      );

    case 'sub-agent':
      // Sub-agent mode: restricted set defined in SUB_AGENT_MODE_TOOL_IDS
      return allTools.filter(t =>
        (SUB_AGENT_MODE_TOOL_IDS as readonly string[]).includes(t.id)
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

export function getToolSystemPrompt(enabledTools: Tool[], model?: string): string {
  if (enabledTools.length === 0) { return ''; }

  const allMetadata = getAllToolMetadata();

  // Separate standard tools from MCP tools
  const standardTools = enabledTools.filter(t => STANDARD_TOOL_IDS.has(t.id));
  const mcpTools = enabledTools.filter(t => !STANDARD_TOOL_IDS.has(t.id));

  // Build standard tools section
  const standardIdsList = standardTools.map(t => `\`${t.id}\``).join(', ');
  const standardToolList = standardTools
    .map((tool) => {
      const metadata = allMetadata.find((m) => m.id === tool.id);
      if (!metadata) { return ''; }
      return `- ${metadata.id}: ${metadata.description}`;
    })
    .filter(Boolean)
    .join('\n');

  // Build MCP tools section (if any)
  const mcpIdsList = mcpTools.map(t => `\`${t.id}\``).join(', ');
  const mcpToolList = mcpTools
    .map((tool) => {
      const metadata = allMetadata.find((m) => m.id === tool.id);
      if (!metadata) { return ''; }
      return `- ${metadata.id}: ${metadata.description}`;
    })
    .filter(Boolean)
    .join('\n');

  // Get MCP usage rules if there are MCP tools
  const mcpToolNames = mcpTools.map(t => t.id);
  const mcpRules = getMcpUsageRules(mcpToolNames);

  // Build the available_tools section (standard tools only)
  const availableToolsSection = standardTools.length > 0
    ? `<available_tools>
Available: ${standardIdsList}
Only use tools listed above. Do not hallucinate non existent tools. What you see is what you get

${standardToolList}
</available_tools>`
    : '';

  // Build the mcp_tools section (only if MCP tools exist)
  const mcpToolsSection = mcpTools.length > 0
    ? `
<mcp_tools>
EXTERNAL TOOLS (Use sparingly - only when absolutely necessary)

Available: ${mcpIdsList}

${mcpToolList}
${mcpRules}
</mcp_tools>`
    : '';

  const formatKind = getToolFormatKind(model);
  const toolFormatSection = formatKind === 'kimi'
    ? `<tool_format>
CRITICAL: Tool calls are a STRICT PROTOCOL.

CANONICAL FORMAT:
<tool_calls_section_begin>
<tool_call_begin> tool_name:0 <tool_call_argument_begin> {"param":"value"} <tool_call_end>
<tool_calls_section_end>

RULES:
1. Output ONLY ONE tool calls section and nothing else.
2. For parallel tools: include multiple <tool_call_begin>...<tool_call_end> blocks inside the single section.
3. The argument payload MUST be a single valid JSON object.
4. Tags must be properly closed.
</tool_format>`
    : `<tool_format>
CRITICAL: You must strictly follow this XML format structure. Valid XML is STRICTLY  required.

WHEN USER ASKS ABOUT FORMAT:
1. Give the format without the "${TOOL_XML_NAMESPACE}" namespace.
2. Follow number 1

SEQUENTIAL EXECUTION:
<${TOOL_XML_NAMESPACE}:function_calls>
    <${TOOL_XML_NAMESPACE}:invoke name="TOOL_NAME">
        <${TOOL_XML_NAMESPACE}:parameter name="param1">value1</${TOOL_XML_NAMESPACE}:parameter>
        <${TOOL_XML_NAMESPACE}:parameter name="param2">value2</${TOOL_XML_NAMESPACE}:parameter>
    </${TOOL_XML_NAMESPACE}:invoke>
</${TOOL_XML_NAMESPACE}:function_calls>

PARALLEL EXECUTION:
<${TOOL_XML_NAMESPACE}:function_calls>
    <${TOOL_XML_NAMESPACE}:invoke name="TOOL_NAME">
        <${TOOL_XML_NAMESPACE}:parameter name="param1">value1</${TOOL_XML_NAMESPACE}:parameter>
        <${TOOL_XML_NAMESPACE}:parameter name="param2">value2</${TOOL_XML_NAMESPACE}:parameter>
    </${TOOL_XML_NAMESPACE}:invoke>
    <${TOOL_XML_NAMESPACE}:invoke name="TOOL_NAME_2">
        <${TOOL_XML_NAMESPACE}:parameter name="param1">value1</${TOOL_XML_NAMESPACE}:parameter>
        <${TOOL_XML_NAMESPACE}:parameter name="param2">value2</${TOOL_XML_NAMESPACE}:parameter>
    </${TOOL_XML_NAMESPACE}:invoke>
</${TOOL_XML_NAMESPACE}:function_calls>

FORMAT RULES:
1. The root element must be <${TOOL_XML_NAMESPACE}:function_calls>.
2. Each tool call must be inside a <${TOOL_XML_NAMESPACE}:invoke> tag.
3. Parameters must be strictly inside <${TOOL_XML_NAMESPACE}:parameter> tags.
4. XML tags must be properly closed.
</tool_format>`;

  return `<tools>
${toolFormatSection}

${availableToolsSection}${mcpToolsSection}
</tools>`;
}
