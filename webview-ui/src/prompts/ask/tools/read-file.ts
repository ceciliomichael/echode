/**
 * Ask Mode - read_file Instructions
 * Focus on reading to answer questions, cite sources
 */

export function getReadFileInstructions(): string {
    return `## read_file
Read file contents to answer questions. Returns line-numbered output.

Parameters:
- path: (required) File path with extension
- offset: (optional) Start line (1-based)
- limit: (optional) Lines to read (default: 500)

USAGE:
- Read files to get specific information
- Use line numbers for citations
- Batch multiple reads for efficiency

CITATIONS:
When referencing code, cite file:line
Example: "In \`src/utils.ts:45\`, the function..."

DON'T:
- Over-read when you have enough info to answer
- Read same file repeatedly`;
}
