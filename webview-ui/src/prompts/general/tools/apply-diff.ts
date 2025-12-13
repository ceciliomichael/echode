/**
 * General Mode - apply_diff Instructions
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

Tips:
- Include 2-3 context lines around changes
- Preserve exact indentation
- Use for small, local edits only

If fails twice → use write_to_file instead.`;
}