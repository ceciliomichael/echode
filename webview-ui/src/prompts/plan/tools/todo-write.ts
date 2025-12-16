/**
 * Plan Mode - todo_write Instructions
 */

export function getTodoWriteInstructions(): string {
    return `## todo_write
Track task progress with a CONCISE list.

Parameters (use ONE option):

Option 1 - JSON:
<parameter name="tasks">[{"id":"1","content":"Task","status":"pending"}]</parameter>

Option 2 - Markdown:
<parameter name="todos">
- [ ] Pending task
- [-] In progress task
- [x] Completed task
</parameter>

Status values: pending, in_progress, completed

STRICT RULES:
- Maximum 5-8 tasks total - no exceptions
- Group related steps into single tasks (e.g., "Update component X and its tests")
- Keep descriptions under 10 words
- No micro-steps like "open file" or "save file"
- Summarize, don't enumerate every detail`;
}