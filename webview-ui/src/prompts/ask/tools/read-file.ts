/**
 * Ask Mode - read_file Instructions
 */

export function getReadFileInstructions(): string {
    return `## read_file
Read file contents with line numbers.

Parameters:
- path: File path (required)
- offset: Start line, 1-based (optional)
- limit: Lines to read, default 500 (optional)

Tips:
- Use line numbers for citations (e.g., "In \`file.ts:45\`...")
- Use offset/limit for large files`;
}