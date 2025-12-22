/**
 * Review Mode - read_file tool instructions
 */

export function getReadFileInstructions(): string {
    return `## read_file
Read and analyze file contents with line numbers.

Parameters:
- path: File path relative to workspace (required)
- offset: Start line, 1-indexed (optional)
- limit: Max lines to read, default 500 (optional)

Usage for Code Review:
- Read entire files to analyze systematically
- Use offset/limit to focus on specific sections
- Line numbers in output help you reference exact locations in findings

Tips:
- Always note the line numbers when you find issues
- Read related files to understand context
- For large files, read in sections to stay focused`;
}