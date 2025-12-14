/**
 * Agent Mode - grep_search Instructions
 */

export function getGrepSearchInstructions(): string {
    return `## grep_search
Fast text search for exact identifiers.

Parameters:
- query: Text to find (required)
- path: Directory to search (recommended)
- isRegex: Enable regex patterns (optional)
- includes: Glob filters like "*.ts,*.tsx" (optional)

When to use:
- You know the EXACT function/variable/class name
- Finding all usages/references
- Simple pattern matching

Tips:
- Always narrow path (e.g., "src/components" not ".")

Use echo_search instead when you need semantic understanding.`;
}