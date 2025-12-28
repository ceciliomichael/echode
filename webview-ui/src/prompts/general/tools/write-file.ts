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
- Creating NEW files that don't exist yet
- Complete rewrites (>50% of file changing)
- After 2 failed apply_diff attempts
- When apply_diff keeps failing due to complex changes

Requirements:
- Content must be COMPLETE (no placeholders like "// rest of code")
- No truncation
- No line numbers in content

**IMPORTANT**: For existing files, ALWAYS try apply_diff first. Only use write_to_file if:
1. The file is NEW (doesn't exist)
2. You're rewriting most of the file (>50%)
3. apply_diff failed twice and you need to force the change`;
}