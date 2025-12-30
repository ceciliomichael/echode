/**
 * Shared glob_search tool instructions
 * Supports multiple formats for different modes
 */

export interface GlobSearchOptions {
    format?: 'markdown' | 'xml';
}

export function getGlobSearchInstructions(options: GlobSearchOptions = {}): string {
    const { format = 'markdown' } = options;

    if (format === 'xml') {
        return `<tool_usage tool="glob_search">
<summary>Find files by name pattern.</summary>
<params>
*   pattern: Glob pattern (required)
*   path: Starting directory (optional)
</params>
<notes>
*   Use to discover files by extension or naming convention.
*   Examples: "**/*.test.ts", "**/components/*.tsx", "**/*auth*"
</notes>
</tool_usage>`;
    }

    return `## glob_search
Find files by name pattern.

Parameters:
- pattern: Glob pattern (required)
- path: Starting directory (optional)

Common patterns:
- "**/*.test.ts" - all test files
- "**/components/*.tsx" - component files
- "**/*auth*" - files with "auth" in name

When to use:
- Find files by extension
- Find files by name pattern
- Discover file structure`;
}