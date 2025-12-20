/**
 * Agent Mode - apply_diff Instructions
 */

export function getApplyDiffInstructions(): string {
    return `## apply_diff
Targeted edits to existing files. PREFERRED tool for edits.

Parameters:
- path: File path (required)
- diff: The diff content (required)

EXACT Format (markers must be on their own lines):
\`\`\`
<<<<<<< SEARCH
:start_line:N
-------
[exact content to find]
=======
[replacement content]
>>>>>>> REPLACE
\`\`\`

COMPLETE EXAMPLE - Changing a function name:
\`\`\`
<<<<<<< SEARCH
:start_line:15
-------
function oldName(x: number): number {
    return x * 2;
}
=======
function newName(x: number): number {
    return x * 2;
}
>>>>>>> REPLACE
\`\`\`

EXAMPLE - Multiple Edits (Use multiple invokes):
\`\`\`xml
<function_calls>
    <invoke name="apply_diff">
        <parameter name="path">src/file.ts</parameter>
        <parameter name="diff">
<<<<<<< SEARCH
:start_line:10
-------
const x = 1;
=======
const x = 10;
>>>>>>> REPLACE
        </parameter>
    </invoke>
    <invoke name="apply_diff">
        <parameter name="path">src/file.ts</parameter>
        <parameter name="diff">
<<<<<<< SEARCH
:start_line:20
-------
const y = 2;
=======
const y = 20;
>>>>>>> REPLACE
        </parameter>
    </invoke>
</function_calls>
\`\`\`

CRITICAL RULES:
- MUST start with \`<<<<<<< SEARCH\` (7 less-than signs + space + SEARCH)
- MUST include \`:start_line:N\` and \`-------\` before search content
- MUST have \`=======\` separator between search and replace
- MUST end with \`>>>>>>> REPLACE\` (7 greater-than signs + space + REPLACE)
- MULTIPLE EDITS: Use separate <invoke> blocks for each edit. DO NOT put multiple SEARCH/REPLACE blocks in one diff.

When to use:
- Small, targeted changes
- Editing <50% of file`;
}