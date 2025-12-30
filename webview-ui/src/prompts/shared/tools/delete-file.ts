/**
 * Shared delete_file tool instructions
 * Supports multiple formats for different modes
 */

export interface DeleteFileOptions {
    format?: 'markdown' | 'xml';
}

export function getDeleteFileInstructions(options: DeleteFileOptions = {}): string {
    const { format = 'markdown' } = options;

    if (format === 'xml') {
        return `<tool_usage tool="delete_file">
<summary>Delete a file from the workspace.</summary>
<params>
*   path: File path (required)
</params>
<notes>
*   Use only when explicitly requested or when safe to remove.
*   Cannot be undone - verify before deleting.
</notes>
</tool_usage>`;
    }

    return `## delete_file
Delete a file from the workspace.

Parameters:
- path: File path (required)

When to use:
- User explicitly requests file deletion
- Removing obsolete or redundant files
- Cleanup during refactoring

Note: This action cannot be undone. Verify before deleting.`;
}