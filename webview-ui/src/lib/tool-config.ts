import type { Tool } from '../types/tool';
import { getAllToolMetadata, getAllTools as getToolsFromRegistry } from './tool-registry';
import type { ChatMode } from '../types/chat-mode';

export const AVAILABLE_TOOLS: Tool[] = getToolsFromRegistry(false);

// Fixed exploration-only tools for Plan mode
const PLAN_MODE_TOOL_IDS = [
  'read_file',
  'list_files',
  'grep_search',
  'glob_search',
  'todo_write',
  'plan_navigator',
  'plan_handoff',
] as const;

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

  if (mode === 'agent') {
    return allTools;
  }

  // Plan mode: filter to exploration tools only
  return allTools.filter(tool => (PLAN_MODE_TOOL_IDS as readonly string[]).includes(tool.id));
}

export function getToolSystemPrompt(enabledTools: Tool[]): string {
  if (enabledTools.length === 0) { return ''; }

  const allMetadata = getAllToolMetadata();

  // Create explicit list of available tool IDs
  const toolIdsList = enabledTools.map(t => `\`${t.id}\``).join(', ');
  const explicitToolList = `
<enabled_tools>
The following tools are AVAILABLE and ENABLED for your use: ${toolIdsList}

These are the ONLY tools you may use. Do not invent or hallucinate other tool names.
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

  const hasFileTools = enabledTools.some((tool) =>
    ['write_to_file', 'apply_diff', 'read_file', 'list_files', 'grep_search', 'glob_search', 'delete_file'].includes(tool.id),
  );
  
  const hasEditingTools = enabledTools.some((tool) =>
    ['write_to_file', 'apply_diff'].includes(tool.id),
  );

  const fileOperationPolicy = hasFileTools
    ? `

<file_operations>
**Critical Rules:**
1. Always call read_file before editing code.
2. Never guess file contents; rely on read_file and tool results.
3. Paths without extensions (no dot after last slash) are DIRECTORIES.

**Directory vs File:**
- DIRECTORY (e.g., src/app, src/routes, api):
  - Do not call read_file${hasEditingTools ? ' or write_to_file' : ''} directly.
  - Use list_files first, then read_file on a specific file.
- FILE (e.g., src/app.ts, api/route.tsx):
  - You may call read_file${hasEditingTools ? ' or write_to_file' : ''} directly.

**Tool Quick Ref:**
- list_files: List directory contents.
- read_file: View file content with line numbers.
- grep_search: Search within files (use specific queries; set isRegex=true only for regex).
- glob_search: Discover files by pattern or fuzzy path.
${hasEditingTools ? `- apply_diff: Preferred for targeted edits to existing files.
- write_to_file: For new files or complete rewrites.
- delete_file: Only when explicitly requested.` : ''}
</file_operations>`
    : '';

  const toolSection = `<tool_calling>
Use tools to perform workspace operations when necessary.

<tool_format>
You MUST use ONLY this XML format for all tool calls:
<function_calls>
<invoke name="TOOL_NAME">
<parameter name="param_name">value</parameter>
</invoke>
</function_calls>

Rules:
1. Always wrap tool calls in <function_calls> tags.
2. Use <invoke name="TOOL_NAME"> with the tool name as an attribute.
3. Use <parameter name="param_name"> with the parameter name as an attribute.
4. Never use markdown code blocks, token markers, or functions.tool_name syntax for tool calls.
5. If you need multiple tools, output separate <function_calls> blocks sequentially.
</tool_format>

${explicitToolList}<available_tools>
${toolDescriptions}${fileOperationPolicy}
</available_tools>

</tool_calling>`;

  return toolSection;
}
