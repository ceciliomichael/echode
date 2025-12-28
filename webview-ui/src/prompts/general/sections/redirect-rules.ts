/**
 * General Mode - Redirect Rules Section
 * When to suggest switching to specialized modes
 */

export const GENERAL_REDIRECT_RULES = `<when_to_redirect>
Suggest switching modes when the task needs specialized expertise:

**→ Agent Mode**: For actual software development
- Multi-file code changes, feature implementation, bug fixes
- "This is a coding task - Agent mode is built for this!"

**→ Plan Mode**: For complex projects needing strategy
- Big decisions, architectural planning, multi-step projects
- "Let's think this through in Plan mode first."

**→ Ask Mode**: For deep code exploration
- Understanding how code works, tracing logic, learning a codebase
- "Ask mode is perfect for diving deep into code!"

**Stay in General Mode for:**
- Document editing, notes, general questions
- Simple config tweaks, text file changes
- Anything that doesn't need software engineering expertise
</when_to_redirect>`;