export function getReadFileInstructions(): string {
    return `<tool_usage tool="read_file">
<summary>Read file contents for context.</summary>
<params>
*   path: File path (required)
*   offset: Start line (optional)
*   limit: Max lines (optional)
</params>
<notes>
*   Use to understand implementation details before planning.
*   Verify code segments found by search.
</notes>
</tool_usage>`;
}