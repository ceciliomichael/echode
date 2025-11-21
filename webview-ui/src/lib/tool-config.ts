import type { Tool } from '../types/tool';
import { getAllToolMetadata, getAllTools as getToolsFromRegistry } from './tool-registry';

export const AVAILABLE_TOOLS: Tool[] = getToolsFromRegistry(false);

// Re-export getAllTools for external use
export function getAllTools(defaultEnabled = true): Tool[] {
  return getToolsFromRegistry(defaultEnabled);
}

export function getToolSystemPrompt(enabledTools: Tool[]): string {
  if (enabledTools.length === 0) {return '';}

  const allMetadata = getAllToolMetadata();
  const toolDescriptions = enabledTools
    .map((tool) => {
      const metadata = allMetadata.find((m) => m.id === tool.id);
      if (!metadata) {return '';}

      const promptDescription = tool.aiDescription || metadata.description;
      return `- **${metadata.id}**: ${promptDescription}
  ${metadata.formatExample}`;
    })
    .filter(Boolean)
    .join('\n');

  const hasFileTools = enabledTools.some((tool) =>
    ['write_to_file', 'read_file', 'list_files', 'grep_search', 'glob_search', 'edit_file', 'multi_edit', 'delete_file'].includes(tool.id),
  );

  const fileOperationPolicy = hasFileTools
    ? `

<file_operations>
**Critical Rules:**
1. **ALWAYS read_file before edit_file** - Never modify without seeing current content
2. **edit_file is PRIMARY editing tool** - Simple find-and-replace (copy exact strings)
3. **Copy EXACT text** - Include all whitespace, indentation, line breaks exactly as shown
4. **Include enough context** - Make old_string unique (appears once in file)
5. **NEVER reuse old_string** - If edit fails, read_file again and copy fresh exact text
6. **DIRECTORY vs FILE detection** - Paths WITHOUT file extensions (no dot after last slash) are DIRECTORIES

**Directory/File Detection (MANDATORY):**
- **DIRECTORY**: No extension after last / (e.g., src/app, src/routes, api, components/ui)
  - ❌ NEVER call read_file or edit_file on these paths
  - ✅ ALWAYS use list_files first, then read_file on specific files from the listing
- **FILE**: Has extension (e.g., src/app.ts, api/route.tsx, README.md)
  - ✅ Use read_file/edit_file directly

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
- **grep_search**: Search file content. Use specific queries + includes filter for file types
- **glob_search**: Find files by pattern (e.g., *.ts, **/*.json). Fast file discovery
- **edit_file**: PRIMARY EDITING TOOL - Find and replace exact strings (single change)
- **multi_edit**: BATCH EDITING TOOL - Apply multiple non-overlapping edits to one file atomically
- **write_to_file**: New files or complete rewrites only. Use edit_file for modifications
- **delete_file**: Only when explicitly requested

**Workflows:**
- **Explore directory**: list_files (e.g., src/app) → read_file on specific files
- **Single change**: read_file → copy EXACT text → edit_file (old_string + new_string)
- **Multiple changes (same file)**: read_file → identify all edits → multi_edit (edits array)
- **Find & modify**: grep_search → read_file → edit_file or multi_edit
- **Large files**: grep_search (get line #) → read_file with custom offset/limit → edit_file

**Common Mistakes:**
- ❌ read_file on src/app (no extension) → ✅ list_files on src/app, then read_file on src/app/page.tsx
- ❌ Retry read_file after "Cannot read directory" error → ✅ Use list_files on that path immediately
- ❌ Modify without reading → ✅ Always read_file first
- ❌ Normalize/clean whitespace when copying → ✅ Copy EXACT text including all spaces/tabs
- ❌ Edit fails, retry same old_string → ✅ read_file again, copy fresh exact text
- ❌ Single line that repeats (e.g., "return null;") → ✅ Include surrounding lines for uniqueness
- ❌ Overlapping edits in multi_edit → ✅ Use single edit_file OR sequence edits properly
- ❌ multi_edit error "Edit N: ..." but retry all edits → ✅ Fix only that specific edit
- ❌ Broad grep "function" → ✅ Specific "handleSubmit" or "UserController"
</file_operations>`
    : '';

  const toolSection = `<tool_calling>
Use tools to perform workspace operations when necessary.

<tool_format>
REQUIRED XML format:
<function_call>
<tool_name>TOOL_NAME</tool_name>
<parameter_name>value</parameter_name>
</function_call>

Parameter types:
- Primitives: Direct value
- Arrays/Objects: JSON format (e.g., <files>[...]</files>)

Examples:
<function_call><tool_name>read_file</tool_name><path>src/app.ts</path></function_call>
<function_call><tool_name>write_to_file</tool_name><path>file.ts</path><content>code</content></function_call>

FORBIDDEN formats (will fail):
- <tool_name>{JSON}</tool_name>
- Control tokens: <|tool_call_begin|>
- Markdown: \`\`\`tool:name
- Colons: <tool:name>

Always close tags properly with </function_call>.
</tool_format>

<available_tools>
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
      grep_search: `<function_call>
<tool_name>grep_search</tool_name>
<query>function</query>
<path>src</path>
</function_call>

With regex:
<function_call>
<tool_name>grep_search</tool_name>
<query>import.*from</query>
<isRegex>true</isRegex>
<includes>["**/*.ts"]</includes>
</function_call>`,
      glob_search: `Find files by glob pattern. Faster than grep_search when you know the file pattern.

Single pattern:
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

Advanced with sorting:
<function_call>
<tool_name>glob_search</tool_name>
<pattern>**/*.json</pattern>
<sortBy>size</sortBy>
<sortOrder>desc</sortOrder>
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
