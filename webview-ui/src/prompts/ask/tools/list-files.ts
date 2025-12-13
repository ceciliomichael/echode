export function getListFilesInstructions(): string {
    return `<tool_usage tool="list_files">
<summary>Explore directory structure.</summary>
<params>
*   path: Directory path (required)
*   recursive: List subdirs (default false)
</params>
<notes>
*   Use to see available files in a folder.
</notes>
</tool_usage>`;
}