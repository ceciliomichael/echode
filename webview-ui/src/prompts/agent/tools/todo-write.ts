/**
 * Agent Mode - todo_write Instructions
 */

export function getTodoWriteInstructions(): string {
    return `## todo_write
Track task progress.

FORMATS:
1. JSON: [{"id":"1","content":"Task","status":"pending"}]
   Status: "pending" | "in_progress" | "completed"

2. Markdown:
   - [ ] Pending
   - [-] In progress
   - [x] Completed

WORKFLOW:
Create tasks → Work through → Mark complete → Next task`;
}
