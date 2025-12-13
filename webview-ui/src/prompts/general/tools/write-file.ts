/**
 * General Mode - write_to_file Instructions
 */

export function getWriteFileInstructions(): string {
    return `## write_to_file
Create new files or complete rewrites.

Parameters:
- path: File path (required)
- content: Complete file content (required)

When to use:
- Creating NEW files
- Complete rewrites (>50% changed)
- After 2 failed apply_diff attempts

Requirements:
- Content must be COMPLETE (no placeholders)
- No truncation
- No line numbers in content

For larger changes, recommend Agent mode.`;
}