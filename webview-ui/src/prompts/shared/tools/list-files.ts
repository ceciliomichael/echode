/**
 * Shared list_files tool instructions
 * Supports multiple formats for different modes
 */

export interface ListFilesOptions {
    format?: 'markdown' | 'xml';
}

export function getListFilesInstructions(options: ListFilesOptions = {}): string {
    const { format = 'markdown' } = options;

    if (format === 'xml') {
        return `<tool_usage tool="list_files">
<summary>Explore directory structure.</summary>
<params>
*   path: Directory to list (Absolute path required)
*   recursive: Include subdirectories (optional)
*   ignoreGitignore: Include gitignored files (optional)
</params>
<notes>
*   Use to understand project layout before diving into files.
*   Helps identify relevant directories to search.
</notes>
</tool_usage>`;
    }

    return `## list_files
Explore directory structure.

Parameters:
- path: Directory to list (Absolute path required)
- recursive: Include subdirectories (default: false)
- ignoreGitignore: Include gitignored files (default: false)

When to use:
- See what's in a directory
- Understand project structure
- Verify paths exist

Note: Use read_file for file contents, not list_files.`;
}