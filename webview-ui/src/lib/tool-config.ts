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
<TOOL_NAME>
<parameter_name>value</parameter_name>
</TOOL_NAME>

Parameter types:
- Primitives: Direct value
- Arrays/Objects: JSON format (e.g., <files>[...]</files>)

Examples:
<read_file><path>src/app.ts</path></read_file>
<write_to_file><path>file.ts</path><content>code</content></write_to_file>

FORBIDDEN formats (will fail):
- <tool_NAME>{JSON}</tool_NAME>
- Control tokens: <|tool_call_begin|>
- Markdown: \`\`\`tool:name
- Colons: <tool:name>

Always close tags properly with </TOOLNAME>.
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
<read_file>
<path>src/app.ts</path>
</read_file>

Large file (with offset/limit):
<read_file>
<path>src/large-file.ts</path>
<offset>1</offset>
<limit>100</limit>
</read_file>

Multiple files (call sequentially):
<read_file>
<path>src/app.ts</path>
</read_file>

<read_file>
<path>src/index.ts</path>
</read_file>`,
      write_to_file: `<write_to_file>
<path>src/new-component.tsx</path>
<content>export default function Component() {
  return <div>Hello</div>;
}</content>
</write_to_file>`,
      list_files: `<list_files>
<path>src/app</path>
</list_files>

Returns:
{
  "directories": [{"name": "components", "type": "directory"}],
  "files": [{"name": "page.tsx", "type": "file"}, {"name": "layout.tsx", "type": "file"}]
}

Next steps:
- To explore "components" → <list_files><path>src/app/components</path></list_files>
- To read "page.tsx" → <read_file><path>src/app/page.tsx</path></read_file>`,
      grep_search: `<grep_search>
<query>function</query>
<path>src</path>
</grep_search>

With regex:
<grep_search>
<query>import.*from</query>
<isRegex>true</isRegex>
<includes>["**/*.ts"]</includes>
</grep_search>`,
      glob_search: `Find files by glob pattern. Faster than grep_search when you know the file pattern.

Single pattern:
<glob_search>
<pattern>*.ts</pattern>
<path>src</path>
</glob_search>

Multiple patterns:
<glob_search>
<pattern>["*.ts", "*.tsx"]</pattern>
<path>src/components</path>
</glob_search>

Advanced with sorting:
<glob_search>
<pattern>**/*.json</pattern>
<sortBy>size</sortBy>
<sortOrder>desc</sortOrder>
</glob_search>

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
<edit_file>
<path>src/app.ts</path>
<edits>[
  {
    "oldString": "export function init() {\\n  const x = 1;\\n  return x;\\n}",
    "newString": "export function init() {\\n  const x = 2;\\n  return x;\\n}"
  }
]</edits>
</edit_file>

Multiple edits (sequential):
<edit_file>
<path>src/config.ts</path>
<edits>[
  {"oldString": "const MODE = 'DEBUG';", "newString": "const MODE = 'PROD';"},
  {"oldString": "const VERSION = '1.0';", "newString": "const VERSION = '2.0';"}
]</edits>
</edit_file>

replaceAll for global changes:
<edit_file>
<path>src/constants.ts</path>
<edits>[{"oldString": "OLD_NAME", "newString": "NEW_NAME", "replaceAll": true}]</edits>
</edit_file>`,
      delete_file: `<delete_file>
<path>src/old-file.ts</path>
</delete_file>`,
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
