/**
 * Plan Mode - todo_write Instructions
 */

export function getTodoWriteInstructions(): string {
    return `## todo_write
Track task progress.

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

Tips:
- Keep task descriptions short and action-focused
- Use for compact task summary only (not full plan)`;
}