/**
 * Agent Mode - todo_write Instructions
 */

export function getTodoWriteInstructions(): string {
    return `## todo_write
Track task progress with a CONCISE list.

Parameters (choose ONE format - do not mix):

**Option 1 - Markdown (RECOMMENDED):**
\`\`\`xml
<invoke name="todo_write">
    <parameter name="todos">
- [ ] First pending task
- [-] Task in progress
- [x] Completed task
    </parameter>
</invoke>
\`\`\`

**Option 2 - JSON Array:**
\`\`\`xml
<invoke name="todo_write">
    <parameter name="tasks">[
  {"id": "1", "content": "First task", "status": "pending"},
  {"id": "2", "content": "Second task", "status": "in_progress"},
  {"id": "3", "content": "Third task", "status": "completed"}
]</parameter>
</invoke>
\`\`\`

CRITICAL FORMAT REQUIREMENTS:
- Use EITHER \`todos\` (markdown) OR \`tasks\` (JSON) - never both
- JSON \`tasks\` MUST be a valid array with objects containing: id, content, status
- Status values: "pending", "in_progress", "completed"
- Markdown checkboxes: [ ] = pending, [-] = in_progress, [x] = completed

COMMON ERRORS TO AVOID:
- ❌ Empty tasks parameter: \`<parameter name="tasks"></parameter>\`
- ❌ Missing required fields: \`[{"content": "task"}]\` (missing id and status)
- ❌ Invalid status: \`"status": "done"\` (use "completed" instead)

STRICT RULES:
- Maximum 5-8 tasks total - no exceptions
- Group related steps into single tasks
- Keep descriptions under 10 words
- No micro-steps - summarize logically related work
- Update status as you complete steps`;
}
