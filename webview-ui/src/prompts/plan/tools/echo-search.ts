/**
 * Plan Mode - echo_search Instructions
 */

export function getEchoSearchInstructions(): string {
    return `## echo_search
Intelligent code exploration sub-agent.

Parameters:
- query: Natural language description (required)
- path: Starting directory (recommended)
- hints: Keywords to help locate code (optional)

When to use:
- Need to understand how something works
- Exploring unfamiliar code
- Don't know exact names/paths

Be specific:
- ❌ "find auth" (too vague)
- ✓ "how is user authentication token validated"

Use grep_search instead when you know the exact identifier.`;
}