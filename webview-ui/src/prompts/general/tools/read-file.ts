/**
 * General Mode - read_file Instructions
 */

export function getReadFileInstructions(): string {
    return `## read_file
Read file contents with line numbers.

Parameters:
- path: File path (required)
- offset: Start line, 1-based (optional)
- limit: Lines to read, default 500 (optional)

Output includes line numbers to help with apply_diff :start_line.

Tips:
- Use offset/limit for large files`;
}