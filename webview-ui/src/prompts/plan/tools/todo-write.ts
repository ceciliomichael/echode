/**
 * Plan Mode - todo_write Instructions
 * Used to document implementation plans
 */

export function getTodoWriteInstructions(): string {
    return `## todo_write
Document your implementation plan as tasks.

FORMATS:
1. JSON: [{"id":"1","content":"Task","status":"pending"}]
   Status: "pending" | "in_progress" | "completed"

2. Markdown:
   - [ ] Pending task
   - [-] In progress
   - [x] Completed

PLANNING WORKFLOW:
1. Explore codebase
2. Ask questions (plan_navigator)
3. Document plan (todo_write)
4. Hand off (plan_handoff)

Keep tasks concise and actionable.`;
}
