/**
 * Plan Mode - plan_handoff Instructions
 * Only use AFTER all questions are resolved
 */

export function getPlanHandoffInstructions(): string {
    return `## plan_handoff
Hand off the completed plan to Agent mode for implementation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ONLY use AFTER all questions are resolved via plan_navigator.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHEN TO USE:
- Plan is complete and documented
- All ambiguities have been clarified
- User is ready to proceed with implementation

Parameters:
- summary: Brief summary of the plan (required)

BEFORE CALLING:
1. Explored codebase sufficiently
2. Asked all clarifying questions (plan_navigator)
3. Documented plan (todo_write)

You CANNOT switch to Agent mode except via this button.
If user replies with text instead of clicking, you are STILL in Plan mode.`;
}
