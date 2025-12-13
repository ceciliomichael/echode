export function getPlanHandoffInstructions(): string {
    return `<tool_usage tool="plan_handoff">
<summary>Handoff completed plan to Agent.</summary>
<params>
*   summary: Brief plan summary (required)
</params>
<notes>
*   **CONFIRMATION REQUIRED**: The user MUST explicitly say "yes" or "proceed" to the plan.
*   Do not assume approval.
*   Once used, the session switches to Agent mode for coding.
</notes>
</tool_usage>`;
}