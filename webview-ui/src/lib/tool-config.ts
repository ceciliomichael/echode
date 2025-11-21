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
    ['write_to_file', 'read_file', 'list_files', 'grep_search', 'glob_search', 'edit_file', 'delete_file'].includes(tool.id),
  );

  const fileOperationPolicy = hasFileTools
    ? `

<file_operations>
**Critical Rules:**
1. **ALWAYS read_file before edit_file** - Never edit without seeing current content
2. **edit_file requires exact matches** - oldString must match exactly (whitespace matters)
3. **Use context for unique matches** - Add surrounding lines to make oldString unique
4. **Sequential edits** - Edits apply in order; Edit 2 sees result of Edit 1

**Tool Quick Ref:**
- FILE (has extension) → read_file/edit_file | DIRECTORY (no extension) → list_files
- **grep_search**: Search file content. Use specific queries + includes filter for file types
- **glob_search**: Find files by pattern (e.g., *.ts, **/*.json). Fast file discovery
- **read_file**: View content. Single file only. Use offset/limit for large files (>1000 lines)
- **edit_file**: Modify via find-replace. Add context to oldString. Use replaceAll for global changes
- **write_to_file**: New files or small rewrites (<100 lines). Prefer edit_file for existing files
- **delete_file**: Only when explicitly requested

**Workflows:**
- **Find files by pattern**: glob_search (*.ts) → read_file → edit_file
- **Find & modify content**: grep_search → read_file → edit_file (with anchored oldString)
- **Large files**: grep_search (get line #) → read_file with offset/limit → edit_file
- **Multiple files**: Call read_file sequentially for each file → edit_file each with proper context

**Common Mistakes:**
- ❌ Read large file without offset/limit → ✅ Use offset/limit for files >1000 lines
- ❌ Edit without reading → ✅ Always read_file first
- ❌ "const x = 1" (not unique) → ✅ Include function context around it
- ❌ Broad grep "function" → ✅ Specific "handleSubmit" or "UserController"
- ❌ Content search when pattern search needed → ✅ Use glob_search for file patterns, grep_search for content
- ❌ Batch reading multiple files → ✅ Call read_file sequentially for each file
- ❌ Sequential: [{old: "a", new: "b"}, {old: "a", new: "c"}] → ✅ [{old: "a", new: "b"}, {old: "b", new: "c"}]
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
      read_file: `Read a single file. For large files (>1000 lines), use offset and limit.

Small file (entire content):
<function_call>
<tool_name>read_file</tool_name>
<path>src/app.ts</path>
</function_call>

Large file (with offset/limit):
<function_call>
<tool_name>read_file</tool_name>
<path>src/large-file.ts</path>
<offset>1</offset>
<limit>100</limit>
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
      edit_file: `CRITICAL: Always read_file first, then use exact content with surrounding context

Good example (with context for unique match):
<function_call>
<tool_name>edit_file</tool_name>
<path>src/app.ts</path>
<edits>[
  {
    "oldString": "export function init() {\\n  const x = 1;\\n  return x;\\n}",
    "newString": "export function init() {\\n  const x = 2;\\n  return x;\\n}"
  }
]</edits>
</function_call>

Multiple edits (sequential):
<function_call>
<tool_name>edit_file</tool_name>
<path>src/config.ts</path>
<edits>[
  {"oldString": "const MODE = 'DEBUG';", "newString": "const MODE = 'PROD';"},
  {"oldString": "const VERSION = '1.0';", "newString": "const VERSION = '2.0';"}
]</edits>
</function_call>

replaceAll for global changes:
<function_call>
<tool_name>edit_file</tool_name>
<path>src/constants.ts</path>
<edits>[{"oldString": "OLD_NAME", "newString": "NEW_NAME", "replaceAll": true}]</edits>
</function_call>`,
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
