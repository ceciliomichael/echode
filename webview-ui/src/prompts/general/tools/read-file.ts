/**
 * General Mode - read_file Instructions
 * Same as Agent - required before edits
 */

export function getReadFileInstructions(): string {
    return `## read_file
Read file contents. Returns line-numbered output.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL: You MUST read_file BEFORE every apply_diff.
This output is your SOURCE OF TRUTH - COPY from it for edits.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Parameters:
- path: (required) File path with extension
- offset: (optional) Start line (1-based)
- limit: (optional) Lines to read (default: 500)

USAGE:
1. Before ANY edit: read_file → COPY content → apply_diff
2. Large files: Use offset/limit to focus only on the relevant region
3. Multiple files: Batch reads in parallel only for a small number of relevant files
4. Avoid reading unrelated files "just in case"; stay within the current request

DON'T type content from memory for edits.

NOTE: Can read files not in context (e.g., .gitignore'd). If user mentions a file, try it.`;
}
