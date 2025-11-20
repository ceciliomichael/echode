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
    ['write_to_file', 'read_file', 'list_files', 'grep_search', 'edit_file', 'delete_file'].includes(tool.id),
  );

  const fileOperationPolicy = hasFileTools
    ? `

<file_operations>
File operations are performed on actual workspace files. Use forward slashes for paths.

Path Rules:
- FILE: Has extension (e.g., "src/app.tsx") → Use read_file/edit_file
- DIRECTORY: No extension (e.g., "src/app") → Use list_files
- Never use read_file on directories

Tool Usage:
- **list_files**: Lists directory contents. Returns directories & files with type field.
- **read_file**: Reads file content. Supports batch mode & line ranges (startLine, endLine).
- **edit_file**: Modifies files. Batch edits via edits array. Read file first; oldString must match exactly.
- **write_to_file**: Creates new files or rewrites short files (<100 lines). Use edit_file for large existing files.
- **grep_search**: Searches workspace files. Set isRegex=true for regex patterns.
- **delete_file**: Deletes file (moves to trash).
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
      read_file: `<read_file>
<path>src/app.ts</path>
</read_file>

With line range:
<read_file>
<path>src/app.ts</path>
<startLine>10</startLine>
<endLine>50</endLine>
</read_file>

Batch (multiple files):
<read_file>
<files>[{"path": "src/app.ts"}, {"path": "src/index.ts"}]</files>
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
      edit_file: `Multiple edits (batch changes):
<edit_file>
<path>src/app.ts</path>
<edits>[
  {"oldString": "const x = 1;", "newString": "const x = 2;"},
  {"oldString": "function old", "newString": "function new"},
  {"oldString": "DEBUG", "newString": "PROD", "replaceAll": true}
]</edits>
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
