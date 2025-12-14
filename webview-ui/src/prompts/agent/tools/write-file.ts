/**
 * Agent Mode - write_to_file Instructions
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
- File becomes shorter after refactor

Requirements:
- Content must be COMPLETE (no placeholders like "// rest of code")
- No truncation
- No line numbers in content

WARNING: This tool is token expensive. Use apply_diff for any edits smaller than the full file.
Use apply_diff instead for targeted edits. Only use write_to_file if you are rewriting the MAJORITY of the file.`;
}