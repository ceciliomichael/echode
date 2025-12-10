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
2. Large files: Use offset/limit (e.g., offset:140, limit:50)
3. Multiple files: Batch reads in parallel

FOR EDITING:
- Line numbers help you set :start_line
- COPY exact content for SEARCH block
- Verify indentation matches

DON'T:
- Type content from memory for edits
- Assume file hasn't changed since last read`;
}
