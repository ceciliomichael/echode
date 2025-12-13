/**
 * Agent Mode - list_files Instructions
 */

export function getListFilesInstructions(): string {
    return `## list_files
Explore directory structure.

Parameters:
- path: Directory to list (required)
- recursive: Include subdirectories (default: false)
- ignoreGitignore: Include gitignored files (default: false)

When to use:
- See what's in a directory
- Understand project structure
- Verify paths exist

Note: Use read_file for file contents, not list_files.`;
}