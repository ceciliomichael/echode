/**
 * General Mode - write_to_file Instructions
 */

export function getWriteFileInstructions(): string {
    return `## write_to_file
Create NEW files or complete file rewrites.

WHEN TO USE:
- Creating NEW files
- Complete rewrites (>50% changed)
- After 2 failed apply_diff attempts

Parameters:
- path: File path (relative to workspace)
- content: COMPLETE file content

Content must be COMPLETE - no placeholders or truncation.`;
}
