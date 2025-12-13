export function getPlanNavigatorInstructions(): string {
    return `<tool_usage tool="plan_navigator">
<summary>Ask the user a clarifying question or request plan approval.</summary>
<params>
*   question: The question string (required)
*   options: Array of options ["Opt A", "Opt B"] (required)
</params>
<when_to_use>
*   During ANALYZE phase: When you need clarification on requirements
*   After OUTPUT phase: **MANDATORY** - You MUST ask for plan approval
*   Example approval question: "Is this plan ready for implementation?" with options ["Yes, proceed with this plan", "No, I have feedback"]
</when_to_use>
<critical_rules>
*   **MANDATORY FOR APPROVAL**: After presenting a plan, you MUST use this tool to ask for approval
*   **NO TEXT QUESTIONS**: NEVER ask questions or request approval in plain text
*   **GATE TO HANDOFF**: User must approve via this tool before you can use \`todo_write\` and \`plan_handoff\`
</critical_rules>
</tool_usage>`;
}