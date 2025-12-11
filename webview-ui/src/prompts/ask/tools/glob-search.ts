/**
 * Ask Mode - glob_search Instructions
 */

export function getGlobSearchInstructions(): string {
    return `## glob_search
Find files by name pattern.

Parameters:
- pattern: Glob pattern (e.g., "**/*.tsx")
- path: Starting directory (optional)

Prefer specific patterns related to the current question; avoid broad discovery scans.`;
}
