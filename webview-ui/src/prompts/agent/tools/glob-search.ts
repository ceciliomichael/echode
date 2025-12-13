/**
 * Agent Mode - glob_search Instructions
 */

export function getGlobSearchInstructions(): string {
    return `## glob_search
Find files by name pattern.

Parameters:
- pattern: Glob pattern (required)
- path: Starting directory (optional)

Common patterns:
- "**/*.test.ts" → all test files
- "**/components/*.tsx" → component files
- "**/*auth*" → files with "auth" in name

When to use:
- Find files by extension
- Find files by name pattern
- Discover file structure`;
}