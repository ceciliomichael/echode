export function getApplyDiffInstructions(): string {
    return `<tool_usage tool="apply_diff">
<summary>Preferred for editing files. Small, local edits.</summary>
<format>
<<<<<<< SEARCH
[exact content from read_file]
=======
[replacement content]
>>>>>>> REPLACE
</format>
<notes>
*   Use for small changes (<50% of file).
*   Content must match exactly.
</notes>
</tool_usage>`;
}