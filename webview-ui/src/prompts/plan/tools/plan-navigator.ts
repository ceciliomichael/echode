/**
 * Plan Mode - plan_navigator Instructions
 */

export function getPlanNavigatorInstructions(): string {
    return `## plan_navigator
Present a question with clickable options.

Parameters:
- question: The question to ask (required)
- options: Array of 1-4 short option strings (required)

MUST use before plan_handoff if ANY uncertainty exists:
- Ambiguous requirements
- Multiple approaches
- Scope questions
- Missing information

Example:
<parameter name="question">Which auth method?</parameter>
<parameter name="options">["JWT tokens", "Session cookies", "OAuth2"]</parameter>

Tips:
- Keep options short (under 40 chars)
- Ask ONE focused question at a time`;
}