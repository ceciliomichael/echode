/**
 * General Mode - delete_file Instructions
 */

export function getDeleteFileInstructions(): string {
    return `<tool_usage tool="delete_file">
<summary>Delete a file.</summary>
<params>
*   path: File path (required)
</params>
<notes>
*   Use only when requested or safe to remove.
</notes>
</tool_usage>`;
}