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
- tasks: Array of task objects containing id, content, and status (required)

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
- Update status ONLY when it actually changes (pending → in_progress → completed)
- Do NOT call \`todo_write\` redundantly if no status has changed

COMPLETION RULES (CRITICAL):
- Mark a task "completed" ONLY after its changes are fully implemented and verified
- Once ALL tasks are "completed", you are DONE. Give a brief final summary and STOP.
- Do NOT call \`todo_write\` again after all tasks are already completed
- Do NOT read more files, explore, or second-guess after all tasks are done
- Do NOT start new work that wasn't in the original task list`;
}