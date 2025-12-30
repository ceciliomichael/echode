/**
 * Shared todo_read tool instructions
 * Supports multiple formats for different modes
 */

export interface TodoReadOptions {
    format?: 'markdown' | 'xml';
}

export function getTodoReadInstructions(options: TodoReadOptions = {}): string {
    const { format = 'markdown' } = options;

    if (format === 'xml') {
        return `<tool_usage tool="todo_read">
<summary>Review current task list.</summary>
<params>
*   No parameters required.
</params>
<notes>
*   Returns tasks with their status (pending, in_progress, completed).
*   Use to check progress before continuing work.
</notes>
</tool_usage>`;
    }

    return `## todo_read
Review current task list.

No parameters required.

Returns tasks with their status (pending, in_progress, completed).`;
}