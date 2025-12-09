import type { Tool } from '../types/tool';
import { getAllToolMetadata, getAllTools as getToolsFromRegistry } from './tool-registry';
import type { ChatMode } from '../types/chat-mode';
import { PARALLEL_ALLOWED_TOOLS } from './tool-parallel-config';

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

  if (mode === 'chat') {
    // Chat mode: no tools at all - pure conversation
    return [];
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

  // Build parallel tools list from enabled tools
  const enabledParallelTools = enabledTools
    .filter(t => PARALLEL_ALLOWED_TOOLS.has(t.id))
    .map(t => t.id);

  const serialOnlyTools = enabledTools
    .filter(t => !PARALLEL_ALLOWED_TOOLS.has(t.id))
    .map(t => t.id);

  // Destructive / write tools should only be mentioned if they are actually enabled
  const destructiveToolIds = ['apply_diff', 'write_to_file', 'delete_file'];
  const enabledDestructiveTools = enabledTools
    .filter(t => destructiveToolIds.includes(t.id))
    .map(t => t.id);

  const parallelRulesSection = `<parallel_execution_rules>
**PARALLEL EXECUTION IS STRICTLY LIMITED:**

ONLY these tools can be batched together in a single <function_calls> block:
${enabledParallelTools.length > 0 ? enabledParallelTools.join(', ') : 'NONE'}

ALL OTHER TOOLS MUST BE CALLED ONE AT A TIME - NEVER batch these:
${serialOnlyTools.length > 0 ? serialOnlyTools.join(', ') : 'none'}
` + (enabledDestructiveTools.length > 0 ? `

**DESTRUCTIVE / WRITE TOOLS (NEVER PARALLELIZE):**
${enabledDestructiveTools.join(', ')}
Each must be in its own separate <function_calls> block and executed sequentially.
` : '') + `
</parallel_execution_rules>`;

  return `<tools>
<tool_format>
**STRICT XML FORMATTING - FOLLOW EXACTLY:**

Format:
\`\`\`xml
<function_calls>
<invoke name="TOOL_NAME">
<parameter name="param1">value1</parameter>
<parameter name="param2">value2</parameter>
</invoke>
</function_calls>
\`\`\`

**CRITICAL RULES:**
1. COMPLETE each </parameter> tag BEFORE starting the next parameter
2. COMPLETE each </invoke> tag BEFORE starting the next invoke
3. NEVER nest invoke blocks inside parameter values
4. NEVER start a new tool call before closing the previous one
5. Each parameter value must be complete - no partial content

**CORRECT - Multiple tools:**
\`\`\`xml
<function_calls>
<invoke name="read_file"><parameter name="path">file1.ts</parameter></invoke>
<invoke name="read_file"><parameter name="path">file2.ts</parameter></invoke>
</function_calls>
\`\`\`

**WRONG - DO NOT DO THIS:**
\`\`\`xml
<invoke name="read_file"><parameter name="path">file1.ts<invoke name="read_file">...
\`\`\`
</tool_format>

${parallelRulesSection}

<available_tools>
Only use tools listed below. If a tool name is not listed here, it does not exist and MUST NOT be called.
Available: ${toolIdsList}
</available_tools>

${toolDescriptions}
</tools>`;
}
