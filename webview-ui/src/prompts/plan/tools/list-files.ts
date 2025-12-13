export function getListFilesInstructions(): string {
    return `<tool_usage tool="list_files">
<summary>Explore directory structure.</summary>
<params>
*   path: Directory path (required)
*   recursive: List subdirs (default false)
</params>
<notes>
*   Map out project structure.
*   Verify paths before reading.
</notes>
</tool_usage>`;
}