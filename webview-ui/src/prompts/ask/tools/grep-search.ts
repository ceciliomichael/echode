/**
 * Ask Mode - grep_search Instructions
 */

export function getGrepSearchInstructions(): string {
    return `## grep_search
Fast text search for KNOWN identifiers.

WHEN TO USE:
- You know EXACT name to find
- Finding all usages/references

Parameters:
- query: Exact text to find (required)
- path: Directory to search (narrow scope)
- isRegex: true for regex patterns

After finding matches → read_file for context.`;
}
