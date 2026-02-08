import { TOOL_XML_NAMESPACE } from '../../tool-xml';

export function getToolInstructions(allowedTools: string[]): string {
  const instructions: string[] = [];

  // Core File Tools
  if (allowedTools.includes('read_file')) {
    instructions.push(`## read_file
Read file contents.

Parameters:
- path: File path (Absolute path required)
- offset: Start line, 1-based (optional)
- limit: Lines to read, default 500 (optional)

Tips:
- Use offset/limit for large files to focus on relevant sections
- Can read files not in context (e.g., .gitignore'd files)`);
  }

  if (allowedTools.includes('write_to_file')) {
    instructions.push(`## write_to_file
**RESTRICTED** - Only for NEW files or complete rewrites when necessary.

**Before using this tool, consider:**
- Does this file already exist? Use \`edit\` instead for efficiency
- Can this change be done incrementally? Use \`edit\` instead

**Use write_to_file ONLY when:**
1. Creating a NEW file that does not exist yet
2. A complete rewrite is genuinely required (use your judgment based on the circumstances)

For all other modifications to existing files, use \`edit\` as it is more efficient and preserves unchanged content.

Parameters:
- path: File path (Absolute path required)
- content: Complete file content (required)

Requirements:
- Content must be COMPLETE (no placeholders like "// rest of code")
- No truncation - include every line
- No line numbers in content

### EXAMPLE - Creating a new file
<${TOOL_XML_NAMESPACE}:function_calls>
<${TOOL_XML_NAMESPACE}:invoke name="write_to_file">
    <${TOOL_XML_NAMESPACE}:parameter name="path">src/utils/helpers.ts</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="content">
export function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

export function capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
    </${TOOL_XML_NAMESPACE}:parameter>
</${TOOL_XML_NAMESPACE}:invoke>
</${TOOL_XML_NAMESPACE}:function_calls>

### EXAMPLE - Complete rewrite (when circumstances require it)
<${TOOL_XML_NAMESPACE}:function_calls>
<${TOOL_XML_NAMESPACE}:invoke name="write_to_file">
    <${TOOL_XML_NAMESPACE}:parameter name="path">src/config.ts</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="content">
// Completely restructured configuration
export const config = {
    api: {
        baseUrl: 'https://api.example.com',
        timeout: 5000,
    },
    features: {
        darkMode: true,
        notifications: true,
    },
};
    </${TOOL_XML_NAMESPACE}:parameter>
</${TOOL_XML_NAMESPACE}:invoke>
</${TOOL_XML_NAMESPACE}:function_calls>`);
  }

  if (allowedTools.includes('edit')) {
    instructions.push(`## edit
**PRIMARY TOOL** - Use this for ALL existing file edits.

Use \`edit\` for targeted edits to existing files using exact string replacement.

Parameters:
- file_path: File path (required)
- old_string: The exact text to replace (required; must be unique unless replace_all is true)
- new_string: Replacement text (required; must be different from old_string)
- explanation: Description of the change being made (required)
- replace_all: Optional boolean; if true replaces all occurrences

### EXAMPLE
<${TOOL_XML_NAMESPACE}:function_calls>
<${TOOL_XML_NAMESPACE}:invoke name="edit">
    <${TOOL_XML_NAMESPACE}:parameter name="file_path">src/file.ts</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="old_string">const DEBUG = false;</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="new_string">const DEBUG = true;</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="explanation">Enable debug logging</${TOOL_XML_NAMESPACE}:parameter>
</${TOOL_XML_NAMESPACE}:invoke>
</${TOOL_XML_NAMESPACE}:function_calls>`);
  }

  if (allowedTools.includes('list_files')) {
    instructions.push(`## list_files
Explore directory structure.

Parameters:
- path: Directory to list (Absolute path required)
- recursive: Include subdirectories (default: false)
- ignoreGitignore: Include gitignored files (default: false)

When to use:
- See what's in a directory
- Understand project structure
- Verify paths exist

Note: Use read_file for file contents, not list_files.`);
  }

  if (allowedTools.includes('grep_search')) {
    instructions.push(`## grep_search
Fast text search for exact identifiers.

Parameters:
- query: Text to find (required)
- path: Directory to search (recommended)
- isRegex: Enable regex patterns (optional)
- includes: Glob filters like "*.ts,*.tsx" (optional)

When to use:
- You know the EXACT function/variable/class name
- Finding all usages/references
- Simple pattern matching

Tips:
- Always narrow path (e.g., "src/components" not ".")`);
  }
  
  if (allowedTools.includes('glob_search')) {
    instructions.push(`## glob_search
Find files by name pattern.

Parameters:
- pattern: Glob pattern (required)
- path: Starting directory (optional)

Common patterns:
- "**/*.test.ts" - all test files
- "**/components/*.tsx" - component files
- "**/*auth*" - files with "auth" in name

When to use:
- Find files by extension
- Find files by name pattern
- Discover file structure`);
  }

  if (allowedTools.includes('get_diagnostics')) {
    instructions.push(`## get_diagnostics
Get linter/compiler errors and warnings.

Parameters:
- path: Optional absolute file or directory path used to filter results. Diagnostics are only collected for files that are currently open in the editor.
- file_pattern: Optional substring filter applied to open file paths.

When to use:
- Check for errors after edits
- Find type errors
- See lint warnings

Workflow: Edit -> get_diagnostics -> fix errors -> verify`);
  }

  if (allowedTools.includes('delete_file')) {
    instructions.push(`## delete_file
Delete a file from the workspace.

Parameters:
- path: File path (Absolute path required)

When to use:
- User explicitly requests file deletion
- Removing obsolete or redundant files
- Cleanup during refactoring

Note: This action cannot be undone. Verify before deleting.`);
  }

  if (allowedTools.includes('todo_write')) {
    instructions.push(`## todo_write
Track task progress with a CONCISE list.

Parameters:
- tasks: JSON Array of objects containing: id, content, status
  - status values: "pending", "in_progress", "completed"

STRICT RULES:
- **NEVER** create an empty task list. At least 1 task is required.
- Maximum 5-8 tasks total.
- Update status as you complete steps.

### EXAMPLE
<${TOOL_XML_NAMESPACE}:function_calls>
<${TOOL_XML_NAMESPACE}:invoke name="todo_write">
    <${TOOL_XML_NAMESPACE}:parameter name="tasks">[
    { "id": "1", "content": "Analyze code", "status": "completed" },
    { "id": "2", "content": "Fix bug", "status": "in_progress" }
]</${TOOL_XML_NAMESPACE}:parameter>
</${TOOL_XML_NAMESPACE}:invoke>
</${TOOL_XML_NAMESPACE}:function_calls>`);
  }

  return instructions.join('\n\n');
}