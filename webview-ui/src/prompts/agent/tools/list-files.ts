/**
 * Agent Mode - list_files Instructions
 */

export function getListFilesInstructions(): string {
    return `## list_files
Explore directory structure.

WHEN TO USE:
- See what's in a directory
- Understand project structure
- Verify paths exist

Parameters:
- path: Directory to list (required)
- recursive: Include subdirectories (default: false)
- ignoreGitignore: Include gitignored files (default: false)

DON'T use on files - use read_file instead.`;
}
