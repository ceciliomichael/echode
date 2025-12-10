/**
 * Agent Mode - grep_search Instructions
 */

export function getGrepSearchInstructions(): string {
    return `## grep_search
Fast text search for KNOWN identifiers.

WHEN TO USE:
- You know the EXACT name (function, variable, class)
- Finding all usages/references
- Simple pattern matching

Parameters:
- query: Exact text to find (required)
- path: Directory to search (ALWAYS specify to narrow scope)
- isRegex: true for regex patterns
- includes: Glob filters (e.g., "*.ts,*.tsx")

BEST PRACTICES:
- Always narrow path (e.g., "src/components" not ".")
- Parallel searches for multiple identifiers
- After grep_search → read_file for full context

USE echo_search INSTEAD when:
- Don't know exact identifier
- Need semantic understanding`;
}
