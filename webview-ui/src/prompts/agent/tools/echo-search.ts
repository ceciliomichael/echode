/**
 * Agent Mode - echo_search Instructions
 */

export function getEchoSearchInstructions(): string {
    return `## echo_search
Intelligent code exploration sub-agent.

WHEN TO USE:
- Need to understand how something works
- Exploring unfamiliar code
- Don't know exact names/paths
- Looking for patterns or architecture

Parameters:
- query: Natural language description (be specific!)
- path: Starting directory (recommended for speed)
- hints: Keywords to help locate code (optional)

WORKFLOW:
echo_search (understand just enough) → grep_search (pinpoint) → read_file (verify) → edit

DON'T USE when:
- You know EXACT function/variable name → grep_search
- You know exact file path → read_file

BE SPECIFIC:
- ❌ "find auth" (too vague)
- ✓ "how is user authentication token validated"

BOUNDS:
- Use a small number of focused echo_search calls to support your mini plan.
- Prefer narrow, targeted queries over broad project-wide exploration.
- Stop using echo_search once you have identified the relevant files/functions for the current task.`;
}
