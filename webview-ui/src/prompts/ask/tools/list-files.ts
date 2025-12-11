/**
 * Ask Mode - list_files Instructions
 */

export function getListFilesInstructions(): string {
    return `## list_files
Explore directory structure.

Parameters:
- path: Directory to list (required)
- recursive: Include subdirectories (default: false)
- ignoreGitignore: Include gitignored files (default: false)

NOTE: If user mentions a path not in context, try it - ignored paths auto-accessible.`;
}
