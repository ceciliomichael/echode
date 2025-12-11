/**
 * Agent Mode - todo_write Instructions
 */

export function getTodoWriteInstructions(): string {
   return `## todo_write
Track task progress. Use ONE of the two parameter options:

OPTION 1 - JSON (use 'tasks' parameter):
<parameter name="tasks">[{"id":"1","content":"First task","status":"pending"},{"id":"2","content":"Second task","status":"in_progress"}]</parameter>

OPTION 2 - Markdown (use 'todos' parameter):
<parameter name="todos">
- [ ] Pending task
- [-] In progress task
- [x] Completed task
</parameter>

STATUS VALUES:
- pending: Not started
- in_progress: Currently working on
- completed: Done

IMPORTANT: Each task in JSON must have id, content, and status fields.

GUIDELINES:
- Map tasks directly to concrete steps in your mini plan.
- Keep the list focused on the current request; avoid unrelated tasks.
- Update statuses as you complete each mini plan step.`;
}
