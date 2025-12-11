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

DON'T use on files - use read_file instead.

NOTE: If user mentions a path not in your context, try it anyway.
Ignored paths (in .gitignore) are auto-accessible when explicitly requested.

GUIDELINES:
- Prefer listing specific directories directly related to your current mini plan.
- Avoid listing very large or top-level directories unless strictly necessary.
- Use list_files to confirm paths and structure, then switch to read_file for details.`;
}
