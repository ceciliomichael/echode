/**
 * Shared read_file tool instructions
 * Supports multiple formats and variants for different modes
 */

export interface ReadFileOptions {
    format?: 'markdown' | 'xml';
    variant?: 'default' | 'review';
}

export function getReadFileInstructions(options: ReadFileOptions = {}): string {
    const { format = 'markdown', variant = 'default' } = options;

    if (format === 'xml') {
        return getXmlFormat();
    }

    if (variant === 'review') {
        return getReviewFormat();
    }

    return getMarkdownFormat();
}

function getMarkdownFormat(): string {
    return `## read_file
Read file contents with line numbers.

Parameters:
- path: File path (required)
- offset: Start line, 1-based (optional)
- limit: Lines to read, default 500 (optional)

Output includes line numbers to help with apply_diff :start_line.

Tips:
- Use offset/limit for large files to focus on relevant sections
- Can read files not in context (e.g., .gitignore'd files)`;
}

function getXmlFormat(): string {
    return `<tool_usage tool="read_file">
<summary>Read file contents with line numbers.</summary>
<params>
*   path: File path (required)
*   offset: Start line, 1-based (optional)
*   limit: Max lines to read (optional)
</params>
<notes>
*   Use to inspect code details and understand implementation.
*   Line numbers in output help reference exact locations.
</notes>
</tool_usage>`;
}

function getReviewFormat(): string {
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