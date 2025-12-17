export function getEchoSearchInstructions(): string {
    return `<tool_usage tool="echo_search">
<summary>Semantic code search.</summary>
<params>
*   query: Natural language question (required)
*   path: Context path (recommended)
</params>
<notes>
*   Use for "how" questions (e.g., "how is auth handled?").
*   Good for broad exploration/understanding.
*   **Use sparingly!** Do not use for finding files or simple content.
*   Use \`grep_search\` if you know the identifier.
</notes>
</tool_usage>`;
}