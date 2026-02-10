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
