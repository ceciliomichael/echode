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
    ['write_file', 'read_file', 'list_files', 'grep_search', 'edit_file', 'delete_file'].includes(tool.id),
  );

  const fileOperationPolicy = hasFileTools
    ? `

<file_operations>
You have access to workspace file operations through the VSCode extension. All operations are performed on actual workspace files.

<path_handling>
- File paths can be relative to workspace root or absolute
- Use forward slashes for paths (e.g., "src/components/Button.tsx")
- Parent directories are created automatically when writing files
</path_handling>

<tool_descriptions>
**read_file**: Read file content with optional line range
- Parameters: path (required), startLine (optional), endLine (optional)
- Returns file content as text
- Cannot be used on directories (use list_files instead)

**write_file**: Create new files or completely overwrite existing files
- Parameters: path (required), content (required)
- Use only for new files or complete rewrites
- Creates parent directories automatically

**list_files**: List contents of a directory
- Parameters: path (optional, defaults to workspace root)
- Returns list of files and subdirectories
- Does not include hidden files (starting with .)

**grep_search**: Search for patterns across workspace files
- Parameters: query (required), path (optional), isRegex (optional), caseSensitive (optional)
- Supports regex patterns when isRegex is true
- Use includes/excludes arrays for file filtering

**edit_file**: Perform targeted find-and-replace operations on files
- Parameters: path (required), edits (array of {oldString, newString, replaceAll})
- Supports MULTIPLE EDITS in a single tool call via the edits array
- Make SPECIFIC, TARGETED changes - avoid large blocks of code in oldString
- Each edit should be precise (a few lines max) for reliability
- All edits are validated before applying - if any fail, none are applied
- Set replaceAll: true for multiple occurrences of the same string
- CRITICAL: Always read the file immediately before editing to ensure exact matches
- The oldString must match exactly including all whitespace, indentation, and line breaks

**delete_file**: Delete a file from the workspace
- Parameters: path (required)
- Moves files to trash/recycle bin for safety
- Cannot delete directories
</tool_descriptions>

<critical_file_operation_rules>
1. Always use read_file immediately before edit_file to get the exact current content
2. For edit_file, the oldString parameter must be an exact character-for-character match including all whitespace
3. Make targeted edits: Use small, specific oldString values (1-5 lines) rather than large code blocks
4. Use multiple edits in one tool call for related changes to the same file
5. Use write_file only for creating new files or when you need to completely rewrite a file
6. If you are uncertain about file content, read the file first rather than relying on previous context
7. After performing file operations, do not re-read files unless specifically needed
</critical_file_operation_rules>
</file_operations>`
    : '';

  const toolSection = `<tool_calling>
You have access to tools that allow you to perform operations in the workspace. Use tools when they are necessary to complete the user's request.

<tool_format>
Tool calls must use the following format exclusively:

\`\`\`tool:TOOL_NAME
{JSON parameters}
\`\`\`

Do not use any other formats such as XML tags, function call syntax, or special delimiters. The triple backtick format with "tool:" prefix is the only supported method.
</tool_format>

<available_tools>
${toolDescriptions}${fileOperationPolicy}
</available_tools>

<tool_usage_examples>
${enabledTools
  .map((tool) => {
    const examples: Record<string, string> = {
      read_file: `Read file:
\`\`\`tool:read_file
{"path": "src/app.ts"}
\`\`\`

Read file with line range:
\`\`\`tool:read_file
{"path": "src/app.ts", "startLine": 10, "endLine": 50}
\`\`\``,
      write_file: `Write file:
\`\`\`tool:write_file
{"path": "src/new-file.ts", "content": "export const hello = 'world';"}
\`\`\``,
      list_files: `List files:
\`\`\`tool:list_files
{"path": "src"}
\`\`\`

List root directory:
\`\`\`tool:list_files
{"path": ""}
\`\`\``,
      grep_search: `Search files:
\`\`\`tool:grep_search
{"query": "function", "path": "src"}
\`\`\`

Search with regex:
\`\`\`tool:grep_search
{"query": "import.*from", "isRegex": true, "includes": ["**/*.ts"], "maxResults": 50}
\`\`\``,
      edit_file: `Edit file (single edit):
\`\`\`tool:edit_file
{"path": "src/app.ts", "edits": [{"oldString": "const x = 1;", "newString": "const x = 2;"}]}
\`\`\`

Edit file (multiple edits):
\`\`\`tool:edit_file
{"path": "src/app.ts", "edits": [{"oldString": "foo", "newString": "bar"}, {"oldString": "old", "newString": "new", "replaceAll": true}]}
\`\`\``,
      delete_file: `Delete file:
\`\`\`tool:delete_file
{"path": "src/unused-file.ts"}
\`\`\``,
    };
    return examples[tool.id] || '';
  })
  .filter(Boolean)
  .join('\n\n')}
</tool_usage_examples>

<tool_execution_workflow>
When using tools, follow this process:
1. Determine if a tool is needed to complete the task
2. Output the tool call block using the correct format
3. The system will execute the tool and provide results
4. Continue your response with the tool results in context
5. Use multiple tools sequentially if needed
</tool_execution_workflow>
</tool_calling>`;

  return toolSection;
}
