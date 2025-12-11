/**
 * Agent Mode - delete_file Instructions
 */

export function getDeleteFileInstructions(): string {
    return `## delete_file
Remove files from workspace.

WHEN TO USE:
- User explicitly requests file deletion
- Removing deprecated/unused files

Parameters:
- path: File path to delete (required)

CAUTION:
- Only use when explicitly requested
- Only delete files that are clearly within the current task's scope.
- Avoid deleting documentation/markdown files unless the user explicitly asks.
- Cannot be undone (except via version control)`;
}
