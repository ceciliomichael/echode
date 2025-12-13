export function getGrepSearchInstructions(): string {
    return `<tool_usage tool="grep_search">
<summary>Fast exact text search.</summary>
<params>
*   query: Search term (required)
*   path: Directory (recommended)
*   includes: File patterns (e.g. "*.ts")
</params>
<notes>
*   Use for finding exact identifiers (functions, vars).
</notes>
</tool_usage>`;
}