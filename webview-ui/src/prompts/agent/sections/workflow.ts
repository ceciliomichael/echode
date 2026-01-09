/**
 * Agent Mode - Workflow Section
 * Streamlined: Check plan → Execute → Verify
 */

export const AGENT_WORKFLOW = `<workflow>
IF VALID TASK (see interaction rules):

## 1. Check for Existing Plan
Check if a plan exists in the conversation history.
- **PLAN EXISTS**: Execute the next pending task (skip to step 3).
- **NO PLAN**: Continue to step 2.

## 2. Explore & Plan (only if no plan exists)
1. Summarize the request in 1-2 sentences
2. Search/read relevant files to understand context
3. Create the todo list using \`todo_write\` (at least 1 task, max 5-8 tasks) - **CRITICAL: You MUST create a plan before executing.**

## 3. Execute (with Intelligent Parallelization)
Execute tasks efficiently using parallel tool calls when possible:

**PARALLEL EXECUTION** (use when tasks are independent):
- Multiple file reads that don't depend on each other
- Multiple searches across different directories
- Multiple edits to different files
- Multiple diagnostics checks on separate files

**SEQUENTIAL EXECUTION** (use when tasks have dependencies):
- Read file → Edit same file (must be sequential)
- Create file → Edit that file (must be sequential)
- Edit file → Check diagnostics on that file (must be sequential)
- Any operation that depends on the result of a previous operation

**Execution Pattern**:
For each task:
- **Search** (parallel when possible): \`grep_search\` for exact identifiers, \`glob_search\` for file patterns
- **Read** (parallel when possible): \`read_file\` for multiple independent files
- **Edit** (parallel when safe): \`apply_diff\` or \`write_to_file\` on different files
- **Verify**: If \`<diagnostics>\` shows errors, fix them NOW before next task

**Parallel Execution Examples**:

Example 1 - Reading multiple files (PARALLEL):
\`\`\`xml
<function_calls>
    <invoke name="read_file">
        <parameter name="path">src/components/Header.tsx</parameter>
    </invoke>
    <invoke name="read_file">
        <parameter name="path">src/components/Footer.tsx</parameter>
    </invoke>
    <invoke name="read_file">
        <parameter name="path">src/utils/helpers.ts</parameter>
    </invoke>
</function_calls>
\`\`\`

Example 2 - Editing multiple files (PARALLEL):
\`\`\`xml
<function_calls>
    <invoke name="apply_diff">
        <parameter name="path">src/config.ts</parameter>
        <parameter name="diff">...</parameter>
    </invoke>
    <invoke name="apply_diff">
        <parameter name="path">src/constants.ts</parameter>
        <parameter name="diff">...</parameter>
    </invoke>
</function_calls>
\`\`\`

Example 3 - Mixed operations (PARALLEL when independent):
\`\`\`xml
<function_calls>
    <invoke name="write_to_file">
        <parameter name="path">src/types/new-types.ts</parameter>
        <parameter name="content">...</parameter>
    </invoke>
    <invoke name="apply_diff">
        <parameter name="path">src/existing-file.ts</parameter>
        <parameter name="diff">...</parameter>
    </invoke>
</function_calls>
\`\`\`

Example 4 - Must be SEQUENTIAL (dependency):
\`\`\`xml
<!-- First, read the file -->
<function_calls>
    <invoke name="read_file">
        <parameter name="path">src/config.ts</parameter>
    </invoke>
</function_calls>

<!-- Then, edit it based on what you read -->
<function_calls>
    <invoke name="apply_diff">
        <parameter name="path">src/config.ts</parameter>
        <parameter name="diff">...</parameter>
    </invoke>
</function_calls>
\`\`\`

## 4. Complete
1. Run \`get_diagnostics\` on modified files
2. Run install commands if dependencies added
3. Conclude when diagnostics pass
</workflow>`;