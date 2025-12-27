/**
 * General Mode - apply_diff Instructions
 */

export function getApplyDiffInstructions(): string {
    return `## apply_diff
Targeted edits to existing files. PREFERRED over write_to_file for small changes.

Parameters:
- path: File path (required)
- diff: The diff content (required)

### FORMAT TEMPLATE
\`\`\`
<<<<<<< SEARCH
:start_line:N
-------
[exact lines to find - COPY from context or read_file output]
=======
[new content to replace with]
>>>>>>> REPLACE
\`\`\`

### CRITICAL: USE CONTENT ALREADY IN CONTEXT
- If you just called read_file or echo_search and the file content is visible above, **USE THAT CONTENT DIRECTLY**
- Do NOT call read_file again if the content is already in your recent context
- Copy the EXACT lines from whatever output you have (preserving whitespace exactly)
- The :start_line number is shown at the beginning of each line in read_file output

### WORKFLOW
1. Check if file content is already in recent context (from read_file, echo_search, or tool results)
2. If YES: Copy exact lines from that context for the SEARCH block
3. If NO or STALE: Call read_file first, then copy from its output
4. Use the line number shown in the output for :start_line:N
5. Apply the diff

### SINGLE EDIT EXAMPLE
Changing a function name at line 15:
\`\`\`xml
<invoke name="apply_diff">
    <parameter name="path">src/utils.ts</parameter>
    <parameter name="diff">
<<<<<<< SEARCH
:start_line:15
-------
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
=======
function computeTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
>>>>>>> REPLACE
    </parameter>
</invoke>
\`\`\`

### MULTIPLE EDITS - Use separate invokes (PARALLEL OK)
\`\`\`xml
</function_calls>
<function_calls>
    <invoke name="apply_diff">
        <parameter name="path">src/file.ts</parameter>
        <parameter name="diff">
<<<<<<< SEARCH
:start_line:5
-------
const DEBUG = false;
=======
const DEBUG = true;
>>>>>>> REPLACE
        </parameter>
    </invoke>
    <invoke name="apply_diff">
        <parameter name="path">src/file.ts</parameter>
        <parameter name="diff">
<<<<<<< SEARCH
:start_line:20
-------
console.log("old message");
=======
console.log("new message");
>>>>>>> REPLACE
        </parameter>
    </invoke>
</function_calls>
\`\`\`

### RULES
1. **ONE SEARCH/REPLACE per invoke** - never multiple blocks in one diff
2. **SEARCH must match EXACTLY** - copy/paste from context, preserve all whitespace
3. **Line number helps locate** - use :start_line from the line numbers shown in output
4. **Markers on own lines** - <<<<<<< SEARCH, =======, >>>>>>> REPLACE
5. **EXACTLY ONE of each marker** - one SEARCH, one separator (=======), one REPLACE

### IF DIFF FAILS
1. Call read_file to get FRESH content (file may have changed)
2. Copy the EXACT lines from the NEW output (don't reuse old content)
3. Retry with the fresh content
4. If still failing after 2 attempts, use write_to_file instead

### WHEN TO USE
- Small changes (<50% of file modified)
- Adding/removing/modifying specific sections
- Prefer over write_to_file for existing files`;
}