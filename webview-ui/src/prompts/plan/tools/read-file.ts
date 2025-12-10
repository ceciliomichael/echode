/**
 * Plan Mode - read_file Instructions
 * NOTE: NO mention of apply_diff or editing - Plan mode is read-only
 */

export function getReadFileInstructions(): string {
    return `## read_file
Read file contents for analysis. Returns line-numbered output.

Parameters:
- path: (required) File path with extension
- offset: (optional) Start line (1-based)
- limit: (optional) Lines to read (default: 500)

USAGE:
1. Explore code you found via search
2. Understand implementation details
3. Gather context for planning

LARGE FILES:
- Use offset/limit for targeted reading
- grep_search first, then read_file on matches

MULTIPLE FILES:
Batch reads in parallel for efficiency.

DON'T:
- Read same file repeatedly unless needed
- Read entire large files when you only need a section`;
}
