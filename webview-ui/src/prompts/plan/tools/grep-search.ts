export function getGrepSearchInstructions(): string {
    return `<tool_usage tool="grep_search">
<summary>Fast exact text search.</summary>
<params>
*   query: Search term (required)
*   path: Directory (recommended)
*   includes: File patterns (e.g. "*.ts")
</params>
<notes>
*   Use to find exact identifiers (functions, classes).
*   Follow up with \`read_file\` to see context.
</notes>
</tool_usage>`;
}