/**
 * Shared grep_search tool instructions
 * Supports multiple formats for different modes
 */

export interface GrepSearchOptions {
    format?: 'markdown' | 'xml';
}

export function getGrepSearchInstructions(options: GrepSearchOptions = {}): string {
    const { format = 'markdown' } = options;

    if (format === 'xml') {
        return `<tool_usage tool="grep_search">
<summary>Fast text search for exact identifiers and patterns.</summary>
<params>
*   query: Text or pattern to find (required)
*   path: Directory to search (recommended)
*   isRegex: Enable regex patterns (optional)
*   includes: Glob filters like "*.ts,*.tsx" (optional)
</params>
<notes>
*   Use when you know the exact function/variable/class name.
*   Best for finding usages and references.
*   Always narrow the path for faster results.
</notes>
</tool_usage>`;
    }

    return `## grep_search
Fast text search for exact identifiers.

Parameters:
- query: Text to find (required)
- path: Directory to search (recommended)
- isRegex: Enable regex patterns (optional)
- includes: Glob filters like "*.ts,*.tsx" (optional)

When to use:
- You know the EXACT function/variable/class name
- Finding all usages/references
- Simple pattern matching

Tips:
- Always narrow path (e.g., "src/components" not ".")

`;
}