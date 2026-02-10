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
Read file contents.

Supports reading text files and common image formats. Images are returned as a downscaled preview.

Parameters:
- path: File path (Absolute path required)
- offset: Start line, 1-based (optional)
- limit: Lines to read, default 500 (optional)

Tips:
- Use offset/limit for large files to focus on relevant sections
- Can read files not in context (e.g., .gitignore'd files)`;
}

function getXmlFormat(): string {
    return `<tool_usage tool="read_file">
<summary>Read file contents.</summary>
<params>
*   path: File path (Absolute path required)
*   offset: Start line, 1-based (optional)
*   limit: Max lines to read (optional)
</params>
<notes>
*   Use to inspect code details and understand implementation.
*   Images return a downscaled preview payload.
</notes>
</tool_usage>`;
}

function getReviewFormat(): string {
    return `## read_file
Read and analyze file contents.

Supports reading text files and common image formats. Images are returned as a downscaled preview.

Parameters:
- path: File path (Absolute path required)
- offset: Start line, 1-based (optional)
- limit: Max lines to read, default 500 (optional)

Usage for Code Review:
- Read entire files to analyze systematically
- Use offset/limit to focus on specific sections

Tips:
- Read related files to understand context
- For large files, read in sections to stay focused`;
}