/**
 * Agent Mode - write_to_file Instructions
 */

export function getWriteFileInstructions(): string {
    return `## write_to_file
Create NEW files or complete file rewrites.

WHEN TO USE:
- Creating NEW files (path doesn't exist)
- Complete rewrites (>50% changed)
- After 2 failed apply_diff attempts
- File is now SHORTER after refactor

Parameters:
- path: File path (relative to workspace)
- content: COMPLETE file content

REQUIREMENTS:
- Content must be COMPLETE - include ALL parts
- No placeholders like "// ... rest of code"
- No truncation
- No line numbers in content

USE apply_diff INSTEAD when:
- Making small, targeted edits
- Changing <30 lines in existing file`;
}
