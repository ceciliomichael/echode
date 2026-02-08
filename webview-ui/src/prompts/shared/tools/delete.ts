/**
 * Shared delete tool instructions
 * Supports multiple formats for different modes
 */

export interface DeleteFileOptions {
    format?: 'markdown' | 'xml';
}

export function getDeleteFileInstructions(options: DeleteFileOptions = {}): string {
    const { format = 'markdown' } = options;

    if (format === 'xml') {
        return `<tool_usage tool="delete">
<summary>Delete a file or folder from the workspace.</summary>
<params>
*   path: File or folder path (Absolute path required)
*   type: "file" or "folder" (Required)
</params>
<notes>
*   Use only when explicitly requested or when safe to remove.
*   Cannot be undone - verify before deleting.
*   For folders, set type to "folder".
</notes>
</tool_usage>`;
    }

    return `## delete
Delete a file or folder from the workspace.

Parameters:
- path: File or folder path (Absolute path required)
- type: "file" or "folder" (Required)

When to use:
* User explicitly requests file or folder deletion
* Removing obsolete or redundant files or directories
* Cleanup during refactoring

Note: This action cannot be undone. Verify before deleting.`;
}