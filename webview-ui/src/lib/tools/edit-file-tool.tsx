import { FilePen } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';

/**
 * Edit File Tool - Find and replace exact strings
 */
async function executeEditFile(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('edit_file', parameters, signal);
}

registerToolPlugin({
  metadata: {
    id: 'edit_file',
    name: 'Edit File',
    description: 'Find and replace exact strings in files - PRIMARY EDITING TOOL',
    aiDescription: `PRIMARY EDITING TOOL - Simple find-and-replace for file modifications. Much easier than unified diffs.

**MANDATORY WORKFLOW:**
1. Call read_file to get current file content (with line numbers)
2. Copy the EXACT text you want to replace from that output
3. Call edit_file with that exact text as old_string
4. Provide new_string as the replacement

**Critical rules:**
- old_string must match EXACTLY (including all whitespace, indentation, line breaks)
- old_string must appear ONCE in the file (not 0 times, not 2+ times)
- old_string and new_string must be different
- Include enough context to make old_string unique

**Why this is robust:**
- No line numbers needed (they confuse you)
- No context lines or diff format
- Just copy exact text and provide replacement
- Tool will tell you if string not found or appears multiple times

**Error handling:**

**STRING_NOT_FOUND** - old_string not in file:
- You didn't copy the exact text (whitespace differs)
- File changed since read_file
- → Call read_file again and copy EXACTLY what you see

**STRING_AMBIGUOUS** - old_string appears multiple times:
- Include more context (surrounding lines) to make it unique
- → Add 2-3 lines before/after to uniquely identify location

**Example 1: Single line edit**
<function_call>
<tool_name>read_file</tool_name>
<path>src/app.ts</path>
</function_call>

Result shows:
\`\`\`
5: const count = 0;
\`\`\`

<function_call>
<tool_name>edit_file</tool_name>
<path>src/app.ts</path>
<old_string>const count = 0;</old_string>
<new_string>const count = 10;</new_string>
</function_call>

**Example 2: Multi-line edit with context**
<function_call>
<tool_name>read_file</tool_name>
<path>src/component.tsx</path>
</function_call>

Result shows:
\`\`\`
10: function MyComponent() {
11:   return (
12:     <div>Hello</div>
13:   );
14: }
\`\`\`

<function_call>
<tool_name>edit_file</tool_name>
<path>src/component.tsx</path>
<old_string>function MyComponent() {
  return (
    <div>Hello</div>
  );
}</old_string>
<new_string>function MyComponent() {
  return (
    <div>
      <h1>Hello</h1>
      <p>Welcome!</p>
    </div>
  );
}</new_string>
</function_call>

**Critical: Copy exact whitespace**
If read_file shows \`"  const x = 1;"\` (2 spaces), your old_string must have exactly 2 spaces.
If you use 4 spaces or tabs, it will fail with STRING_NOT_FOUND.

**When to include more context:**
- Single line that might repeat → include line before and after
- Common pattern (e.g., \`return null;\`) → include surrounding function
- Multiple edits in same file → do them one at a time, call read_file between each`,
    icon: FilePen,
    usage: 'Find and replace exact strings - PRIMARY EDITING TOOL',
    formatExample: '<function_call>\n<tool_name>edit_file</tool_name>\n<path>src/app.ts</path>\n<old_string>const x = 1;</old_string>\n<new_string>const x = 2;</new_string>\n</function_call>',
  },
  handler: {
    execute: executeEditFile,
  },
  // No renderer needed - diff viewer in tool-block.tsx handles visualization
  renderer: undefined,
});
