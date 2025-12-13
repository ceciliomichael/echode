export function getReadFileInstructions(): string {
    return `<tool_usage tool="read_file">
<summary>Read file contents.</summary>
<params>
*   path: File path (required)
*   offset: Start line (optional)
*   limit: Max lines (optional)
</params>
<notes>
*   Use to inspect code details for answering.
</notes>
</tool_usage>`;
}