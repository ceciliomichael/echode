/**
 * Review Mode - list_files tool instructions
 */

export function getListFilesInstructions(): string {
    return `## list_files
Explore directory structure to understand codebase organization.

Parameters:
- path: Directory to list (required)
- recursive: Include subdirectories (default: false)

Usage for Code Review:
- Understand project structure before diving into code
- Identify which files need reviewing
- Find related files (tests, configs, types)

Tips:
- Start with root to get overview
- Look for patterns (tests near source, shared utils, etc.)`;
}