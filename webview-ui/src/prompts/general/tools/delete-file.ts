export function getDeleteFileInstructions(): string {
    return `<tool_usage tool="delete_file">
<summary>Delete a file.</summary>
<params>
*   path: File path (required)
</params>
<notes>
*   Use only when explicitly requested.
</notes>
</tool_usage>`;
}