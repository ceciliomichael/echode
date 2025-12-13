export function getPlanNavigatorInstructions(): string {
    return `<tool_usage tool="plan_navigator">
<summary>Ask the user a clarifying question.</summary>
<params>
*   question: The question string (required)
*   options: Array of options ["Opt A", "Opt B"] (required)
</params>
<notes>
*   **MANDATORY**: You MUST use this tool for ANY clarifying question.
*   **Approvals**: Use this to ask "Is the plan ready?" or "Shall I proceed?".
*   Do NOT ask questions in plain text.
</notes>
</tool_usage>`;
}