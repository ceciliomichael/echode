/**
 * Shared todo_write tool instructions
 * Supports multiple formats for different modes
 */

export interface TodoWriteOptions {
    format?: 'markdown' | 'xml';
}

export function getTodoWriteInstructions(options: TodoWriteOptions = {}): string {
    const { format = 'markdown' } = options;

    if (format === 'xml') {
        return getXmlFormat();
    }

    return getMarkdownFormat();
}

function getXmlFormat(): string {
    return `<tool_usage tool="todo_write">
<summary>Track task progress with a concise list.</summary>
<params>
*   tasks: JSON array format
</params>
<notes>
*   JSON: objects with id, content, status fields
*   Maximum 5-8 tasks total.
*   **NEVER** create an empty task list.
</notes>
</tool_usage>`;
}

function getMarkdownFormat(): string {
    return `## todo_write
Track task progress with a CONCISE list.

Parameters:

Use the tasks parameter with objects containing: id, content, status
Status values: "pending", "in_progress", "completed"

CRITICAL FORMAT REQUIREMENTS:
- JSON tasks MUST be a valid array with objects containing: id, content, status

COMMON ERRORS TO AVOID:
- Empty tasks parameter
- Missing required fields in JSON (id and status)
- Invalid status value (use "completed" not "done")

STRICT RULES:
- **NEVER** create an empty task list. At least 1 task is required.
- Maximum 5-8 tasks total - no exceptions
- Group related steps into single tasks
- Keep descriptions under 10 words
- No micro-steps - summarize logically related work
- Update status as you complete steps`;
}