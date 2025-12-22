/**
 * Review Mode - glob_search tool instructions
 */

export function getGlobSearchInstructions(): string {
    return `## glob_search
Find files by name pattern.

Parameters:
- pattern: Glob pattern (required)
- path: Starting directory (optional)

Usage for Code Review:
- Find all files of a type: "**/*.ts", "**/*.tsx"
- Locate config files: "**/*.config.*", "**/.*rc"
- Find test files: "**/*.test.ts", "**/*.spec.ts"
- Identify entry points: "**/index.ts", "**/main.ts"

Tips:
- Use to scope your review to specific file types
- Find related files (e.g., all API handlers)`;
}