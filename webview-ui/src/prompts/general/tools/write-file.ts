export function getWriteFileInstructions(): string {
    return `<tool_usage tool="write_to_file">
<summary>Create or overwrite a file.</summary>
<params>
*   path: File path (required)
*   content: Full file content (required)
</params>
<notes>
*   Use for new files or when apply_diff fails.
*   Suggest Agent Mode for large rewrites.
</notes>
</tool_usage>`;
}