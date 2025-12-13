/**
 * Agent Mode - apply_diff Instructions
 */

export function getApplyDiffInstructions(): string {
    return `## apply_diff
Targeted edits to existing files.

Parameters:
- path: File path (required)
- diff: The diff content (required)

Format:
<<<<<<< SEARCH
:start_line:N
-------
[exact content from read_file]
=======
[replacement content]
>>>>>>> REPLACE

Multiple edits: Use multiple SEARCH/REPLACE blocks in one call.

When to use:
- Small, targeted changes
- Editing <50% of file

Tips:
- Include 2-3 context lines around changes
- Preserve exact indentation
- :start_line helps locate the section`;
}