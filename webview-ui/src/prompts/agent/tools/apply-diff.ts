/**
 * Agent Mode - apply_diff Instructions
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
[exact lines to find - COPY from read_file output]
=======
[new content to replace with]
>>>>>>> REPLACE
\`\`\`

### REQUIRED WORKFLOW
1. **ALWAYS read_file first** to see current content with line numbers
2. **COPY the exact lines** from read_file output for the SEARCH block (never type from memory)
3. **Use the line number** shown in read_file output for :start_line:N
4. Apply the diff

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
2. **SEARCH must match exactly** - copy/paste from read_file, preserve whitespace
3. **Line number helps locate** - use :start_line from read_file output
4. **Markers on own lines** - <<<<<<< SEARCH, =======, >>>>>>> REPLACE

### IF DIFF FAILS
1. Call read_file to get fresh content
2. Copy the EXACT lines from output (don't retype)
3. Retry with correct content
4. If still failing after 2 attempts, use write_to_file instead

### WHEN TO USE
- Small changes (<50% of file modified)
- Adding/removing/modifying specific sections
- Prefer over write_to_file for existing files`;
}