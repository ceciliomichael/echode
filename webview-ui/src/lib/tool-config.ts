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
<function_call><tool_name>read_file</tool_name><path>src/app</path></function_call>

✅ CORRECT - list directory first, then read specific file:
<function_call><tool_name>list_files</tool_name><path>src/app</path></function_call>
(sees: page.tsx, layout.tsx, etc.)
<function_call><tool_name>read_file</tool_name><path>src/app/page.tsx</path></function_call>

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

🚫 **CRITICAL: NEVER USE = IN XML TAGS** 🚫
❌ WRONG: <tool_name=list_files>
✅ CORRECT: <tool_name>list_files</tool_name>

You MUST use ONLY this XML format:
<function_call>
<tool_name>TOOL_NAME</tool_name>
<parameter_name>value</parameter_name>
</function_call>

⚠️ **DO NOT USE XML ATTRIBUTES - Values go BETWEEN tags, NOT after =** ⚠️

**ABSOLUTE RULES:**
1. 🚫 **NEVER EVER use = inside tags** - <tool_name=value> is FORBIDDEN - use <tool_name>value</tool_name>
2. **NEVER** use <|tool_call_begin|>, <|tool_calls_section_begin|>, or any |token| format
3. **NEVER** use functions.tool_name:0 format
4. **NEVER** use markdown code blocks
5. **ALWAYS** use <function_call> tags
6. **ALWAYS** close with </function_call>

✅ **CORRECT FORMAT ONLY (value BETWEEN tags):**
<function_call><tool_name>read_file</tool_name><path>src/app.ts</path></function_call>

✅ **CORRECT - tool name goes BETWEEN <tool_name> and </tool_name>:**
<function_call><tool_name>list_files</tool_name><path>.</path></function_call>

❌ **FORBIDDEN FORMATS (WILL FAIL):**
- <|tool_call_begin|>functions.read_file:0<|tool_call_end|>
- functions.read_file:0
- \`\`\`tool:read_file
- <tool_name>read_file</tool_name>
- <tool_name=read_file> (XML attributes are FORBIDDEN)
- <function_call><tool_name=read_file></tool_name> (NEVER use = in tags)
- Any format with |tokens|

**CRITICAL XML RULES:**
1. **NO XML ATTRIBUTES**: NEVER use = inside tags. Use <tool_name>value</tool_name> NOT <tool_name=value>
2. **ONE opening tag per call**: Never output <function_call> twice
3. **ALWAYS close with </function_call>**: Every opening tag needs a closing tag
4. **No nested function_call tags**: Never put <function_call> inside another <function_call>
5. **Sequential calls**: Close previous call before opening next one

Parameter types:
- Primitives: Direct value
- Arrays/Objects: JSON format (e.g., <files>[...]</files>)

✅ CORRECT - Single opening tag:
<function_call><tool_name>read_file</tool_name><path>src/app.ts</path></function_call>

✅ CORRECT - Multiple sequential calls (each properly closed):
<function_call><tool_name>read_file</tool_name><path>file1.ts</path></function_call>
<function_call><tool_name>read_file</tool_name><path>file2.ts</path></function_call>

❌ WRONG - Duplicate opening tag:
<function_call>
<function_call>
<tool_name>read_file</tool_name>

❌ WRONG - Missing closing tag:
<function_call><tool_name>read_file</tool_name><path>file.ts</path>
<function_call><tool_name>grep_search</tool_name>

❌ WRONG - Token format:
<|tool_calls_section_begin|><|tool_call_begin|>functions.read_file:0<|tool_call_end|><|tool_calls_section_end|>

❌ WRONG - Functions format:
functions.read_file:0

❌ WRONG - XML attributes (THIS IS THE MOST COMMON ERROR - DO NOT DO THIS):
<function_call><tool_name=list_files></tool_name><path>.</path></function_call>
THIS WILL FAIL! Use <tool_name>list_files</tool_name> instead!

❌ WRONG - Another attribute example (FORBIDDEN):
<function_call><tool_name=read_file></tool_name><path=src/app.ts></path></function_call>

**IF YOU USE ANY FORMAT OTHER THAN THE XML FORMAT SHOWN ABOVE, YOUR TOOL CALLS WILL FAIL!**
**CRITICAL: Tags must contain values between opening and closing, NOT as attributes with =**
**REMEMBER: <tag>value</tag> is CORRECT, <tag=value> is WRONG and will cause errors!**
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
<function_call>
<tool_name>read_file</tool_name>
<path>src/app.ts</path>
</function_call>

Custom range:
<function_call>
<tool_name>read_file</tool_name>
<path>src/large-file.ts</path>
<offset>101</offset>
<limit>50</limit>
</function_call>

More lines (up to 200):
<function_call>
<tool_name>read_file</tool_name>
<path>src/medium.ts</path>
<limit>200</limit>
</function_call>

Multiple files (call sequentially):
<function_call>
<tool_name>read_file</tool_name>
<path>src/app.ts</path>
</function_call>

<function_call>
<tool_name>read_file</tool_name>
<path>src/index.ts</path>
</function_call>`,
          write_to_file: `<function_call>
<tool_name>write_to_file</tool_name>
<path>src/new-component.tsx</path>
<content>export default function Component() {
  return <div>Hello</div>;
}</content>
</function_call>`,
          list_files: `<function_call>
<tool_name>list_files</tool_name>
<path>src/app</path>
</function_call>

Returns:
{
  "directories": [{"name": "components", "type": "directory"}],
  "files": [{"name": "page.tsx", "type": "file"}, {"name": "layout.tsx", "type": "file"}]
}

Next steps:
- To explore "components" → <function_call><tool_name>list_files</tool_name><path>src/app/components</path></function_call>
- To read "page.tsx" → <function_call><tool_name>read_file</tool_name><path>src/app/page.tsx</path></function_call>`,
          grep_search: `Smart content search.

Natural-language (semantic-lite, default):
<function_call>
<tool_name>grep_search</tool_name>
<query>job content moderation pending rejected</query>
<path>src</path>
</function_call>

With regex:
<function_call>
<tool_name>grep_search</tool_name>
<query>import.*from</query>
<isRegex>true</isRegex>
<includes>["**/*.ts"]</includes>
</function_call>`,
          glob_search: `Smart file discovery.

Glob pattern (precise):
<function_call>
<tool_name>glob_search</tool_name>
<pattern>*.ts</pattern>
<path>src</path>
</function_call>

Multiple patterns:
<function_call>
<tool_name>glob_search</tool_name>
<pattern>["*.ts", "*.tsx"]</pattern>
<path>src/components</path>
</function_call>

Natural-language fuzzy path (no *, ?, [], {}):
<function_call>
<tool_name>glob_search</tool_name>
<pattern>job content moderation</pattern>
<path>src</path>
</function_call>

Returns:
{
  "totalFiles": 15,
  "results": [
    {"path": "src/app.ts", "name": "app.ts", "size": 2048, "extension": "ts"},
    {"path": "src/utils.ts", "name": "utils.ts", "size": 1024, "extension": "ts"}
  ]
}`,
          delete_file: `<function_call>
<tool_name>delete_file</tool_name>
<path>src/old-file.ts</path>
</function_call>`,
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
