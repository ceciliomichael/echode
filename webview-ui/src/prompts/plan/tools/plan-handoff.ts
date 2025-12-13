/**
 * Plan Mode - plan_handoff Instructions
 */

export function getPlanHandoffInstructions(): string {
    return `## plan_handoff
Hand off completed plan to Agent mode for implementation.

Parameters:
- summary: Brief summary of the plan (required)

When to use:
- Plan is complete and documented
- All ambiguities clarified via plan_navigator
- User is ready to proceed

Before calling:
1. Explored codebase sufficiently
2. Asked all clarifying questions
3. Documented plan in chat
4. Created compact task list via todo_write

IMPORTANT:
- Cannot switch to Agent mode except via this tool
- If user replies with text instead of clicking button, handoff is invalidated`;
}