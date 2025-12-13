export function getGlobSearchInstructions(): string {
    return `<tool_usage tool="glob_search">
<summary>Find files by pattern.</summary>
<params>
*   pattern: Glob string (e.g. "**/*.ts")
*   path: Directory (optional)
</params>
<notes>
*   Use to find files by name/extension.
</notes>
</tool_usage>`;
}