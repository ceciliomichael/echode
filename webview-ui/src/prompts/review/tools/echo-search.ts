/**
 * Review Mode - echo_search tool instructions
 */

export function getEchoSearchInstructions(): string {
    return `## echo_search
Intelligent codebase exploration for understanding architecture.

Parameters:
- query: Natural language question (required)
- path: Starting directory (recommended)
- hints: Keywords to help locate code (optional)

Usage for Code Review:
- Understand data flow: "how does user input reach the database"
- Trace authentication: "how is user authentication handled"
- Find security boundaries: "where is input validation performed"
- Understand error handling: "how are errors propagated and logged"

When to Use:
- Complex architectural questions
- Tracing data through multiple files
- Understanding unfamiliar code patterns

Note: Use sparingly - prefer grep_search for specific patterns.`;
}