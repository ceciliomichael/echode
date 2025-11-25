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
1. **ALWAYS read_file before editing** - Never modify without seeing current content
${hasEditingTools ? `2. **apply_diff is PRIMARY editing tool** - Use for ALL targeted edits to existing files
3. **write_to_file for new files or full rewrites** - Use only when creating new files or completely rewriting existing ones
4. **NEVER guess content** - Always read_file first to verify exact content
5. **DIRECTORY vs FILE detection** - Paths WITHOUT file extensions (no dot after last slash) are DIRECTORIES` : `2. **NEVER guess content** - Always read_file first to verify exact content
3. **DIRECTORY vs FILE detection** - Paths WITHOUT file extensions (no dot after last slash) are DIRECTORIES`}

**Directory/File Detection (MANDATORY):**
- **DIRECTORY**: No extension after last / (e.g., src/app, src/routes, api, components/ui)
  - ❌ NEVER call read_file${hasEditingTools ? ' or write_to_file' : ''} on these paths
  - ✅ ALWAYS use list_files first, then read_file on specific files from the listing
- **FILE**: Has extension (e.g., src/app.ts, api/route.tsx, README.md)
  - ✅ Use read_file${hasEditingTools ? '/write_to_file' : ''} directly

**Examples:**
❌ WRONG - calling read_file on directory:
<function_calls><invoke name="read_file"><parameter name="path">src/app</parameter></invoke></function_calls>

✅ CORRECT - list directory first, then read specific file:
<function_calls><invoke name="list_files"><parameter name="path">src/app</parameter></invoke></function_calls>
(sees: page.tsx, layout.tsx, etc.)
<function_calls><invoke name="read_file"><parameter name="path">src/app/page.tsx</parameter></invoke></function_calls>

**Tool Quick Ref:**
- **list_files**: List directory contents. Use for paths WITHOUT extensions
- **read_file**: View file content with line numbers. Defaults to first 100 lines. Use ONLY for paths WITH extensions
- **grep_search**: Smart content search. For non-regex queries it uses semantic-lite matching on tokens and phrases; use specific names or short descriptions plus includes filters for file types. Set isRegex=true only when you need strict regex.
- **glob_search**: Smart file search. Use real glob patterns (e.g., *.ts, **/*.json) for precise matches, or natural-language patterns (no *, ?, [], {}) for fuzzy path search by concept.${hasEditingTools ? `
- **apply_diff**: PRIMARY EDITING TOOL - Use for ALL targeted edits to existing files (preferred over write_to_file)
- **write_to_file**: Use ONLY for creating new files or completely rewriting existing files
- **delete_file**: Only when explicitly requested` : ''}

**Workflows:**
- **Explore directory**: list_files (e.g., src/app) → read_file on specific files${hasEditingTools ? `
- **Edit existing file**: read_file → identify changes → apply_diff (preferred) or write_to_file (full rewrite only)
- **Create new file**: write_to_file
- **Find & modify**: grep_search → read_file → apply_diff
- **Large files**: grep_search (get line #) → read_file with custom offset/limit → apply_diff` : ''}

**Common Mistakes:**
- ❌ read_file on src/app (no extension) → ✅ list_files on src/app, then read_file on src/app/page.tsx
- ❌ Retry read_file after "Cannot read directory" error → ✅ Use list_files on that path immediately
- ❌ Modify without reading → ✅ Always read_file first
- ❌ Broad grep "function" → ✅ Specific "handleSubmit" or "UserController"
</file_operations>`
    : '';

  const toolSection = `<tool_calling>
Use tools to perform workspace operations when necessary.

<tool_format>
🚨 **MANDATORY XML FORMAT - NO EXCEPTIONS** 🚨

You MUST use ONLY this XML format:
<function_calls>
<invoke name="TOOL_NAME">
<parameter name="param_name">value</parameter>
</invoke>
</function_calls>

**ABSOLUTE RULES:**
1. **ALWAYS** wrap tool calls in <function_calls> tags
2. **ALWAYS** use <invoke name="TOOL_NAME"> with the tool name as an attribute
3. **ALWAYS** use <parameter name="param_name"> with the parameter name as an attribute
4. **NEVER** use <|tool_call_begin|>, <|tool_calls_section_begin|>, or any |token| format
5. **NEVER** use functions.tool_name:0 format
6. **NEVER** use markdown code blocks for tool calls

✅ **CORRECT FORMAT:**
<function_calls>
<invoke name="read_file">
<parameter name="path">src/app.ts</parameter>
</invoke>
</function_calls>

✅ **CORRECT - Compact format:**
<function_calls><invoke name="list_files"><parameter name="path">.</parameter></invoke></function_calls>

❌ **FORBIDDEN FORMATS (WILL FAIL):**
- <|tool_call_begin|>functions.read_file:0<|tool_call_end|>
- functions.read_file:0
- \`\`\`tool:read_file
- <function_call><tool_name>read_file</tool_name>...</function_call>
- Any format with |tokens|

**CRITICAL XML RULES:**
1. **ONE function_calls block per tool**: Close </function_calls> before starting a new one
2. **No nested function_calls tags**: Never put <function_calls> inside another <function_calls>
3. **Sequential calls**: Close previous call before opening next one

Parameter types:
- Primitives: Direct value between <parameter> tags
- Arrays/Objects: JSON format (e.g., <parameter name="files">[...]</parameter>)

✅ CORRECT - Multiple sequential calls (each properly closed):
<function_calls><invoke name="read_file"><parameter name="path">file1.ts</parameter></invoke></function_calls>
<function_calls><invoke name="read_file"><parameter name="path">file2.ts</parameter></invoke></function_calls>

❌ WRONG - Duplicate opening tag:
<function_calls>
<function_calls>
<invoke name="read_file">

❌ WRONG - Missing closing tag:
<function_calls><invoke name="read_file"><parameter name="path">file.ts</parameter></invoke>
<function_calls><invoke name="grep_search">

**IF YOU USE ANY FORMAT OTHER THAN THE XML FORMAT SHOWN ABOVE, YOUR TOOL CALLS WILL FAIL!**
</tool_format>

${explicitToolList}<available_tools>
${toolDescriptions}${fileOperationPolicy}
</available_tools>

<tool_usage_examples>
${enabledTools
      .map((tool) => {
        const examples: Record<string, string> = {
          read_file: `Read a single file. Defaults to first 100 lines. Use offset/limit for custom ranges.

Default (first 100 lines):
<function_calls>
<invoke name="read_file">
<parameter name="path">src/app.ts</parameter>
</invoke>
</function_calls>

Custom range:
<function_calls>
<invoke name="read_file">
<parameter name="path">src/large-file.ts</parameter>
<parameter name="offset">101</parameter>
<parameter name="limit">50</parameter>
</invoke>
</function_calls>

More lines (up to 200):
<function_calls>
<invoke name="read_file">
<parameter name="path">src/medium.ts</parameter>
<parameter name="limit">200</parameter>
</invoke>
</function_calls>

Multiple files (call sequentially):
<function_calls>
<invoke name="read_file">
<parameter name="path">src/app.ts</parameter>
</invoke>
</function_calls>

<function_calls>
<invoke name="read_file">
<parameter name="path">src/index.ts</parameter>
</invoke>
</function_calls>`,
          write_to_file: `<function_calls>
<invoke name="write_to_file">
<parameter name="path">src/new-component.tsx</parameter>
<parameter name="content">export default function Component() {
  return <div>Hello</div>;
}</parameter>
</invoke>
</function_calls>`,
          list_files: `<function_calls>
<invoke name="list_files">
<parameter name="path">src/app</parameter>
</invoke>
</function_calls>

Returns:
{
  "directories": [{"name": "components", "type": "directory"}],
  "files": [{"name": "page.tsx", "type": "file"}, {"name": "layout.tsx", "type": "file"}]
}

Next steps:
- To explore "components" → <function_calls><invoke name="list_files"><parameter name="path">src/app/components</parameter></invoke></function_calls>
- To read "page.tsx" → <function_calls><invoke name="read_file"><parameter name="path">src/app/page.tsx</parameter></invoke></function_calls>`,
          grep_search: `Smart content search.

Natural-language (semantic-lite, default):
<function_calls>
<invoke name="grep_search">
<parameter name="query">job content moderation pending rejected</parameter>
<parameter name="path">src</parameter>
</invoke>
</function_calls>

With regex:
<function_calls>
<invoke name="grep_search">
<parameter name="query">import.*from</parameter>
<parameter name="isRegex">true</parameter>
<parameter name="includes">["**/*.ts"]</parameter>
</invoke>
</function_calls>`,
          glob_search: `Smart file discovery.

Glob pattern (precise):
<function_calls>
<invoke name="glob_search">
<parameter name="pattern">*.ts</parameter>
<parameter name="path">src</parameter>
</invoke>
</function_calls>

Multiple patterns:
<function_calls>
<invoke name="glob_search">
<parameter name="pattern">["*.ts", "*.tsx"]</parameter>
<parameter name="path">src/components</parameter>
</invoke>
</function_calls>

Natural-language fuzzy path (no *, ?, [], {}):
<function_calls>
<invoke name="glob_search">
<parameter name="pattern">job content moderation</parameter>
<parameter name="path">src</parameter>
</invoke>
</function_calls>

Returns:
{
  "totalFiles": 15,
  "results": [
    {"path": "src/app.ts", "name": "app.ts", "size": 2048, "extension": "ts"},
    {"path": "src/utils.ts", "name": "utils.ts", "size": 1024, "extension": "ts"}
  ]
}`,
          delete_file: `<function_calls>
<invoke name="delete_file">
<parameter name="path">src/old-file.ts</parameter>
</invoke>
</function_calls>`,
        };
        return examples[tool.id] || '';
      })
      .filter(Boolean)
      .join('\n\n')}
</tool_usage_examples>

<tool_execution_workflow>
1. Determine if tool is needed
2. Output tool call in correct XML format
3. System executes and returns results
4. Continue with results in context
5. Chain multiple tools sequentially as needed
</tool_execution_workflow>
</tool_calling>`;

  return toolSection;
}
