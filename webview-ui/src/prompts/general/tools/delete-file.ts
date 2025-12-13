/**
 * General Mode - delete_file Instructions
 */

export function getDeleteFileInstructions(): string {
    return `## delete_file
Remove files from workspace.

Parameters:
- path: File path to delete (required)

When to use:
- User explicitly requests file deletion

Caution: Cannot be undone (except via version control).`;
}