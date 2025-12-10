/**
 * General Mode - delete_file Instructions
 */

export function getDeleteFileInstructions(): string {
    return `## delete_file
Remove files from workspace.

WHEN TO USE:
- User explicitly requests file deletion

Parameters:
- path: File path to delete (required)

Only use when explicitly requested. Cannot be undone.`;
}
