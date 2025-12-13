export function getGlobSearchInstructions(): string {
    return `<tool_usage tool="glob_search">
<summary>Find files by pattern.</summary>
<params>
*   pattern: Glob string (e.g. "**/*.test.ts")
*   path: Directory (optional)
</params>
<notes>
*   Find files by extension or name pattern.
</notes>
</tool_usage>`;
}