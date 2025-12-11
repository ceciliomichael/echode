/**
 * Ask Mode - grep_search Instructions
 */

export function getGrepSearchInstructions(): string {
    return `## grep_search
Fast text search for KNOWN identifiers.

WHEN TO USE:
- You know EXACT name to find
- Finding all usages/references

PARAMETERS:
- query: Exact text to find (required)
- path: Directory to search (always as narrow as possible)
- isRegex: true for regex patterns

After finding matches → read_file for just enough context to answer the question.`;
}
