export function getReadFileInstructions(): string {
    return `<tool_usage tool="read_file">
<summary>Read file contents.</summary>
<params>
*   path: File path (required)
*   offset: Start line (optional)
*   limit: Max lines (optional)
</params>
<notes>
*   Use to get content for editing or understanding.
</notes>
</tool_usage>`;
}