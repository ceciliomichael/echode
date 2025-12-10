/**
 * Plan Mode - echo_search Instructions
 * Focus on exploration and understanding, NOT editing
 */

export function getEchoSearchInstructions(): string {
    return `## echo_search
Intelligent code exploration sub-agent.

WHEN TO USE:
- Need to understand how something works
- Exploring unfamiliar codebase areas
- Don't know exact names/paths
- Looking for patterns or architecture

Parameters:
- query: Natural language description (be specific!)
- path: Starting directory (recommended for speed)
- hints: Keywords to help locate code (optional)

WORKFLOW:
echo_search (understand) → grep_search (pinpoint) → read_file (details) → document plan

DON'T USE when:
- You know EXACT function/variable name → grep_search
- You know exact file path → read_file

BE SPECIFIC:
- ❌ "find auth" (too vague)
- ✓ "how is user authentication token validated"

DON'T OVER-RELY:
- Use echo_search to START exploration
- Switch to grep_search once you know identifiers`;
}
