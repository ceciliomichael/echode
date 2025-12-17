/**
 * Agent Mode - echo_search Instructions
 */

export function getEchoSearchInstructions(): string {
    return `## echo_search
Intelligent code exploration sub-agent.

Parameters:
- query: Natural language description (required)
- path: Starting directory (recommended)
- hints: Keywords to help locate code (optional)

When to use:
- Need to understand how something works (architecture/logic)
- Exploring unfamiliar, complex code
- Looking for patterns or high-level context
- "Plan Mode" style deep dives

When NOT to use:
- finding specific files (use list_files or grep_search)
- checking simple file content (use read_file)
- "basic stuff" where context is obvious
- you just need to find a definition (use grep_search)

Be specific:
- ❌ "find auth" (too vague)
- ✓ "how is user authentication token validated"

Use grep_search instead when you know the exact identifier.`;
}