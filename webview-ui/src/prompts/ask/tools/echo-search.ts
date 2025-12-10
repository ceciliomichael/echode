/**
 * Ask Mode - echo_search Instructions
 * Focus on finding answers to questions
 */

export function getEchoSearchInstructions(): string {
    return `## echo_search
Intelligent code exploration to find answers.

WHEN TO USE:
- Need to understand how something works
- Finding implementation details
- Don't know exact names/paths

Parameters:
- query: Natural language description (be specific!)
- path: Starting directory (recommended)
- hints: Keywords to help locate code (optional)

BE SPECIFIC:
- ❌ "find auth" (too vague)
- ✓ "how is user authentication implemented"

USE grep_search INSTEAD when:
- You know EXACT function/variable name`;
}
