/**
 * Ask Mode - echo_search Instructions
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
- Don't know exact names/paths
- Finding implementation details

Be specific:
- ❌ "find auth" (too vague)
- ✓ "how is user authentication implemented"

Use grep_search instead when you know the exact identifier.`;
}