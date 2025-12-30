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
*   todos: Markdown format task list (Option 1)
*   tasks: JSON array format (Option 2)
</params>
<notes>
*   Use EITHER todos (markdown) OR tasks (JSON) - never both.
*   Markdown: [ ] = pending, [-] = in_progress, [x] = completed
*   JSON: objects with id, content, status fields
*   Maximum 5-8 tasks total.
</notes>
</tool_usage>`;
}

function getMarkdownFormat(): string {
    return `## todo_write
Track task progress with a CONCISE list.

Parameters (choose ONE format - do not mix):

**Option 1 - Markdown (RECOMMENDED):**
Use the todos parameter with checkbox syntax:
- [ ] = pending
- [-] = in_progress  
- [x] = completed

**Option 2 - JSON Array:**
Use the tasks parameter with objects containing: id, content, status
Status values: "pending", "in_progress", "completed"

CRITICAL FORMAT REQUIREMENTS:
- Use EITHER todos (markdown) OR tasks (JSON) - never both
- JSON tasks MUST be a valid array with objects containing: id, content, status

COMMON ERRORS TO AVOID:
- Empty tasks parameter
- Missing required fields in JSON (id and status)
- Invalid status value (use "completed" not "done")

STRICT RULES:
- Maximum 5-8 tasks total - no exceptions
- Group related steps into single tasks
- Keep descriptions under 10 words
- No micro-steps - summarize logically related work
- Update status as you complete steps`;
}