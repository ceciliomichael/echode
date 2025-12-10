/**
 * Plan Mode - plan_navigator Instructions
 * CRITICAL: Must use before plan_handoff if any uncertainty
 */

export function getPlanNavigatorInstructions(): string {
    return `## plan_navigator
Present a question with clickable options to guide planning.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL: MUST use BEFORE plan_handoff if ANY uncertainty exists.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHEN TO USE (REQUIRED):
- Ambiguous requirements
- Multiple possible implementation approaches
- Scope questions
- Technology/pattern choices
- Missing information
- Assumptions that need validation

Parameters:
- question: The question to ask (required)
- options: Array of 1-4 short option strings (required)

BEST PRACTICES:
- Keep question clear and concise
- Keep options short (under 40 chars each)
- Ask ONE focused question at a time

EXAMPLE:
<parameter name="question">Which auth method should we use?</parameter>
<parameter name="options">["JWT tokens", "Session cookies", "OAuth2"]</parameter>

DO NOT proceed to plan_handoff without asking if uncertainty exists.`;
}
