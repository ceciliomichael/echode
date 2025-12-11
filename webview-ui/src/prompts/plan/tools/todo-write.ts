/**
 * Plan Mode - todo_write Instructions
 * Used to document implementation plans
 */

export function getTodoWriteInstructions(): string {
   return `## todo_write
Capture a compact, high-level task list that corresponds to the plan you described in chat. Use ONE of the two parameter options:

OPTION 1 - JSON (use 'tasks' parameter):
<parameter name="tasks">[{"id":"1","content":"Explore auth module","status":"pending"},{"id":"2","content":"Ask about API approach","status":"in_progress"}]</parameter>

OPTION 2 - Markdown (use 'todos' parameter):
<parameter name="todos">
- [ ] First task
- [-] In progress task
- [x] Completed task
</parameter>

STATUS VALUES:
- pending: Not started
- in_progress: Currently working on
- completed: Done

Keep tasks concise and actionable.
IMPORTANT: Each task in JSON must have id, content, and status fields.

GUIDELINES:
- Use todo_write only for a short, high-level task list that mirrors the chat plan.
- Do NOT paste the full natural-language plan, explanations, or mermaid diagrams here.
- The primary source of truth for the plan is the structured chat response.`;
}
