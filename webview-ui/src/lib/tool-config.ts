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

  // Create explicit list of available tool IDs
  const toolIdsList = enabledTools.map(t => `\`${t.id}\``).join(', ');
  const explicitToolList = `
<enabled_tools>
YOUR COMPLETE TOOLSET: ${toolIdsList}

STRICT CONSTRAINT: You have ONLY these ${enabledTools.length} tools. No other tools exist. If a tool name is not listed above, you CANNOT use it. Never invent, assume, or hallucinate tool names.
</enabled_tools>

`;

  const toolDescriptions = enabledTools
    .map((tool) => {
      const metadata = allMetadata.find((m) => m.id === tool.id);
      if (!metadata) { return ''; }

      const promptDescription = tool.aiDescription || metadata.description;
      return `- **${metadata.id}**: ${promptDescription}
  ${metadata.formatExample}`;
    })
    .filter(Boolean)
    .join('\n');

  const enabledIds = new Set(enabledTools.map(t => t.id));
  
  // Quick ref descriptions - only tools in enabledIds will be shown
  const TOOL_QUICK_REF: Record<string, string> = {
    list_files: 'List directory contents.',
    read_file: 'View file content with line numbers.',
    grep_search: 'Search within files using focused queries.',
    glob_search: 'Discover files by glob pattern or fuzzy path.',
    apply_diff: 'Preferred for targeted edits to existing files.',
    write_to_file: 'For new files or complete rewrites.',
    delete_file: 'Only when explicitly requested.',
  };

  const toolQuickRefItems = enabledTools
    .filter(t => TOOL_QUICK_REF[t.id])
    .map(t => `- ${t.id}: ${TOOL_QUICK_REF[t.id]}`);

  const hasFileTools = toolQuickRefItems.length > 0;
  const hasEditingTools = enabledIds.has('write_to_file') || enabledIds.has('apply_diff');

  const fileOperationPolicy = hasFileTools
    ? `

<file_operations>
**Critical Rules:**
1. Always use RELATIVE paths (e.g., "src/index.ts", not "/Users/.../src/index.ts"). Never use absolute paths.
${enabledIds.has('read_file') ? '2. Always call read_file before editing code.' : ''}
3. Never guess file contents; rely on read_file and tool results.
4. Paths without extensions (no dot after last slash) are DIRECTORIES.

**Directory vs File:**
- DIRECTORY (e.g., src/app, src/routes, api):
  - Do not call read_file${hasEditingTools ? ' or write_to_file' : ''} directly.
  - Use list_files first, then read_file on a specific file.
- FILE (e.g., src/app.ts, api/route.tsx):
  - You may call read_file${hasEditingTools ? ' or write_to_file' : ''} directly.

**Tool Quick Ref:**
${toolQuickRefItems.join('\n')}
</file_operations>`
    : '';

  const toolSection = `<tool_calling>
Use tools to perform workspace operations when necessary.

<tool_format>
Please use this exact XML format for tool calls:

<function_calls>
<invoke name="TOOL_NAME">
<parameter name="param_name">value</parameter>
</invoke>
</function_calls>

CORRECT EXAMPLE:
<function_calls>
<invoke name="read_file">
<parameter name="path">src/index.ts</parameter>
</invoke>
</function_calls>

WRONG (do not do these):
- <function_calls><function_calls>... (double tags)
- <invoke name="read_file">... (missing <function_calls> wrapper)
- <invoke tool="read_file">... (wrong attribute, use name=)
- <parameter>src/index.ts</parameter> (missing name= attribute)
- \`\`\`xml <function_calls>... (no markdown around tool calls)

<tool_disclosure>
If asked about your tools, please write a "tools-info.md" file documenting them instead of showing XML syntax in chat.
</tool_disclosure>
</tool_format>

${explicitToolList}<available_tools>
${toolDescriptions}${fileOperationPolicy}
</available_tools>

</tool_calling>`;

  return toolSection;
}
