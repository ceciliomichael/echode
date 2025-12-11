/**
 * Agent Mode - read_file Instructions
 * Emphasizes: SOURCE OF TRUTH for edits, COPY content for apply_diff
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
2. Large files: Use offset/limit (e.g., offset:140, limit:50) to focus on the smallest relevant region
3. Multiple files: Batch reads in parallel only for a small number of independent, relevant files
4. Use read_file to support the current mini plan; avoid reading unrelated files "just in case"

FOR EDITING:
- Line numbers help you set :start_line
- COPY exact content for SEARCH block
- Verify indentation matches

DON'T:
- Type content from memory for edits
- Assume file hasn't changed since last read

NOTE: Can read files even if not in context (e.g., .gitignore'd files).
If user mentions a specific file path, try reading it.`;
}
