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

CRITICAL RULES:
- MUST start with \`<<<<<<< SEARCH\` (7 less-than signs + space + SEARCH)
- MUST include \`:start_line:N\` and \`-------\` before search content
- MUST have \`=======\` separator between search and replace
- MUST end with \`>>>>>>> REPLACE\` (7 greater-than signs + space + REPLACE)
- For multi-edits, use multi <invoke> blocks, one per edit

When to use:
- Small, targeted changes
- Editing <50% of file`;
}