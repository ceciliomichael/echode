/**
 * Ask Mode - list_files Instructions
 */

export function getListFilesInstructions(): string {
    return `## list_files
Explore directory structure (small, relevant areas only).

Parameters:
- path: Directory to list (required)
- recursive: Include subdirectories (default: false)
- ignoreGitignore: Include gitignored files (default: false)

NOTE: Prefer listing specific directories related to the current question. Avoid listing very large or top-level directories unless strictly necessary.`;
}
