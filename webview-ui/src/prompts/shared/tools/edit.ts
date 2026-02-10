/**
 * Shared edit tool instructions
 * Primary tool for ALL existing file edits
 */

import { TOOL_XML_NAMESPACE } from '../../../lib/tool-xml';

export function getEditInstructions(): string {
    return `## edit
**PRIMARY TOOL** - Use this for ALL existing file edits.

Use \`edit\` for targeted edits to existing files using exact string replacement.

Parameters:
- file_path: File path (required)
- old_string: The exact text to replace (required; must be unique unless replace_all is true)
- new_string: Replacement text (required; must be different from old_string)
- explanation: Description of the change being made (required)
- replace_all: Optional boolean; if true replaces all occurrences

### WHEN TO READ BEFORE EDITING
- **MUST read first**: File not yet seen in this conversation, or file was modified by another tool/step since you last saw it
- **SKIP reading**: File content is already in the conversation context and hasn't changed since
- **Rule**: If uncertain whether you have the current content, read first. A wasted read is better than a failed edit.

### CRITICAL: old_string ACCURACY
- old_string must be copied **exactly** from the file content you have in context (from \`read_file\` output or prior tool results)
- Include enough surrounding lines to make old_string unique in the file
- **Never guess or reconstruct** old_string from memory — always use the exact text you can see
- Whitespace, indentation, and punctuation must match exactly

### IF AN EDIT FAILS (STRICT RECOVERY PROTOCOL)
- If the tool says **old_string not found**:
  - Do NOT retry with a guessed old_string
  - If the error includes line numbers/snippet context, immediately call \`read_file\` for that region and copy the exact text
  - Retry the edit once with the exact old_string copied from \`read_file\`
- If the tool says **old_string must be unique**:
  - Do NOT guess which occurrence to edit
  - Expand old_string to include more surrounding context so it matches only one place, OR set replace_all=true if the request truly intends all occurrences
- Avoid unnecessary \`write_to_file\` rewrites: a failed edit means your old_string was wrong or stale. Re-read and retry; do not rewrite the whole file as a workaround.

### EXAMPLE
<${TOOL_XML_NAMESPACE}:function_calls>
<${TOOL_XML_NAMESPACE}:invoke name="edit">
    <${TOOL_XML_NAMESPACE}:parameter name="file_path">src/file.ts</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="old_string">const DEBUG = false;</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="new_string">const DEBUG = true;</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="explanation">Enable debug logging</${TOOL_XML_NAMESPACE}:parameter>
</${TOOL_XML_NAMESPACE}:invoke>
</${TOOL_XML_NAMESPACE}:function_calls>`;
}
