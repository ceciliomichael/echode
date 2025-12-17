export function getApplyDiffInstructions(): string {
    return `<tool_usage tool="apply_diff">
<summary>Preferred for editing files. Small, local edits.</summary>
<format>
<<<<<<< SEARCH
:start_line:N
-------
[exact content to find]
=======
[replacement content]
>>>>>>> REPLACE
</format>
<example>
<<<<<<< SEARCH
:start_line:10
-------
const value = 1;
=======
const value = 2;
>>>>>>> REPLACE
</example>
<notes>
*   MUST start with \`<<<<<<< SEARCH\`
*   MUST include \`:start_line:N\` and \`-------\`
*   Use for small changes (<50% of file)
</notes>
</tool_usage>`;
}