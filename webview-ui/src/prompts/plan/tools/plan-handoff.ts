export function getPlanHandoffInstructions(): string {
    return `<tool_usage tool="plan_handoff">
<summary>Handoff completed plan to Agent mode for implementation.</summary>
<params>
*   summary: Brief plan summary (required)
</params>
<prerequisites>
1. User MUST have approved the plan via \`plan_navigator\` (selected "Yes" option)
2. You MUST have created tasks with \`todo_write\` BEFORE calling this tool
</prerequisites>
<workflow>
After user approves via plan_navigator:
1. First: \`todo_write\` - Create task list from the approved plan
2. Then: \`plan_handoff\` - Transfer to Agent mode with the summary
</workflow>
<critical_rules>
*   **NEVER** use this tool before user explicitly approves via \`plan_navigator\`
*   **NEVER** use this tool before creating tasks with \`todo_write\`
*   **NEVER** assume approval - wait for explicit "Yes" selection
*   Once used, the session switches to Agent mode for coding implementation
</critical_rules>
</tool_usage>`;
}