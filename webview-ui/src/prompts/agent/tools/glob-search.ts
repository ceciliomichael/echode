/**
 * Agent Mode - glob_search Instructions
 */

export function getGlobSearchInstructions(): string {
    return `## glob_search
Find files by name pattern.

WHEN TO USE:
- Find files by extension (*.test.ts)
- Find files by name pattern
- Discover file structure

Parameters:
- pattern: Glob pattern (e.g., "**/*.tsx")
- path: Starting directory (optional)

COMMON PATTERNS:
- "**/*.test.ts" → all test files
- "**/components/*.tsx" → all component files
- "**/*auth*" → files with "auth" in name

GUIDELINES:
- Prefer specific, narrow patterns that target files referenced in your mini plan.
- Avoid broad repo-wide discovery scans unless absolutely necessary for the task.
- Use glob_search to locate candidates, then switch to read_file for precise context.`;
}
