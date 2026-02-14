/**
 * Shared edit tool instructions
 * Primary tool for ALL existing file edits
 */

import { TOOL_XML_NAMESPACE } from '../../../lib/tool-xml';

export function getEditInstructions(): string {
    return `## edit
**PRIMARY TOOL** - Use this for ALL existing file edits.

Use \`edit\` for targeted edits to existing files using exact string replacement with optional line-range scoping for precision. The tool is tolerant of whitespace/indentation drift **inside the specified line range** (exact → whitespace-tolerant → indentation-flexible), but only within that range.

Parameters:
- file_path: File path (required)
- old_string: The exact text to replace (required; must be unique unless replace_all is true)
- new_string: Replacement text (required; must be different from old_string)
- explanation: Description of the change being made (required)
- start_line: 1-based start line number to scope the edit (optional but STRONGLY recommended)
- end_line: 1-based end line number to scope the edit (optional but STRONGLY recommended)
- replace_all: Optional boolean; if true replaces all occurrences (ignores line range)

### LINE-RANGE SCOPING (RECOMMENDED)
When you provide \`start_line\` and \`end_line\`, the edit tool narrows its search to ONLY that line range. This:
- **Eliminates ambiguity**: old_string only needs to be unique within the range, not the entire file
- **Prevents wrong-location edits**: The tool won't accidentally match text elsewhere
- **Tolerates whitespace/indentation drift inside the range**: whitespace/indentation differences are handled; trailing newline after the range is also handled
- **Gives instant feedback on failure**: If old_string doesn't match, the tool returns the ACTUAL content at those lines so you can self-correct immediately without a separate read_file call

**How to get line numbers**: Use the line numbers from \`read_file\` output (format: \`LINE_NUM | content\`). The start_line/end_line should cover the lines containing your old_string.

### SMART READ-BEFORE-EDIT WORKFLOW
1. **ALWAYS read first** if: file not yet seen in this conversation, OR file was modified since you last read it
2. **SKIP reading** if: file content is already in context and hasn't changed
3. **Rule**: If uncertain, read first. A wasted read is far better than a failed edit.
4. When you read a file, note the line numbers — use them in your edit's start_line/end_line for precision. Keep ranges tight around the snippet.

### CRITICAL: old_string ACCURACY
- old_string must be copied **exactly** from the file content you have in context (from \`read_file\` output or prior tool results)
- Include enough surrounding lines to make old_string unique in the file (or use start_line/end_line to scope it)
- **Never guess or reconstruct** old_string from memory — always use the exact text you can see
- Whitespace, indentation, and punctuation must match exactly

### IF AN EDIT FAILS (STRICT RECOVERY PROTOCOL)
1. **Line-range edit failed**: The error includes the ACTUAL content at your specified lines. Copy the exact text from the error output into old_string and retry immediately. No need to call read_file.
2. **old_string not found (no line range)**: Call \`read_file\` for the relevant region, then retry with exact text and line numbers.
3. **old_string not unique**: Add start_line/end_line to scope the match, OR expand old_string with more context, OR set replace_all=true.
4. **Never** fall back to \`write_to_file\` as a workaround for failed edits. Re-read and retry instead.

### EXAMPLE — Basic edit (no line range)
<${TOOL_XML_NAMESPACE}:function_calls>
<${TOOL_XML_NAMESPACE}:invoke name="edit">
    <${TOOL_XML_NAMESPACE}:parameter name="file_path">src/file.ts</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="old_string">const DEBUG = false;</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="new_string">const DEBUG = true;</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="explanation">Enable debug logging</${TOOL_XML_NAMESPACE}:parameter>
</${TOOL_XML_NAMESPACE}:invoke>
</${TOOL_XML_NAMESPACE}:function_calls>

### EXAMPLE — Line-range scoped edit (RECOMMENDED)
<${TOOL_XML_NAMESPACE}:function_calls>
<${TOOL_XML_NAMESPACE}:invoke name="edit">
    <${TOOL_XML_NAMESPACE}:parameter name="file_path">src/utils/config.ts</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="old_string">const timeout = 3000;</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="new_string">const timeout = 5000;</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="start_line">42</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="end_line">42</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="explanation">Increase timeout to 5 seconds</${TOOL_XML_NAMESPACE}:parameter>
</${TOOL_XML_NAMESPACE}:invoke>
</${TOOL_XML_NAMESPACE}:function_calls>

### EXAMPLE — Multi-line edit with line range
<${TOOL_XML_NAMESPACE}:function_calls>
<${TOOL_XML_NAMESPACE}:invoke name="edit">
    <${TOOL_XML_NAMESPACE}:parameter name="file_path">src/api/handler.ts</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="old_string">  if (response.ok) {
    return response.json();
  }</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="new_string">  if (response.ok) {
    const data = await response.json();
    return data;
  }</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="start_line">15</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="end_line">17</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="explanation">Await response.json() before returning</${TOOL_XML_NAMESPACE}:parameter>
</${TOOL_XML_NAMESPACE}:invoke>
</${TOOL_XML_NAMESPACE}:function_calls>`;
}
