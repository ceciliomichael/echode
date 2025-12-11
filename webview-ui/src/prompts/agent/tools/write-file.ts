/**
 * Agent Mode - write_to_file Instructions
 */

export function getWriteFileInstructions(): string {
    return `## write_to_file
Create NEW files or complete file rewrites.

⚠️ CRITICAL: ONE write_to_file PER RESPONSE. Never batch multiple write_to_file or apply_diff calls in parallel.

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

PLANNING & SCOPE:
- Ensure the new or rewritten file is part of your current mini plan.
- Prefer write_to_file for code/config/tests; only create or overwrite documentation/markdown when the user explicitly asks.

USE apply_diff INSTEAD when:
- Making small, targeted edits
- Changing <30 lines in existing file`;
}
