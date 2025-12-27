/**
 * Plan Mode - todo_write Instructions
 */

export function getTodoWriteInstructions(): string {
    return `## todo_write
Track task progress with a CONCISE list.

Parameters (choose ONE format - do not mix):

**Option 1 - Markdown (RECOMMENDED):**
<function_calls>
<invoke name="todo_write">
    <parameter name="todos">
- [ ] First pending task
- [-] Task in progress
- [x] Completed task
    </parameter>
</invoke>
</function_calls>

**Option 2 - JSON Array:**
<function_calls>
<invoke name="todo_write">
    <parameter name="tasks">[
  {"id": "1", "content": "First task", "status": "pending"},
  {"id": "2", "content": "Second task", "status": "in_progress"},
  {"id": "3", "content": "Third task", "status": "completed"}
]</parameter>
</invoke>
</function_calls>

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
- Group related steps into single tasks (e.g., "Update component X and its tests")
- Keep descriptions under 10 words
- No micro-steps like "open file" or "save file"
- Summarize, don't enumerate every detail`;
}
