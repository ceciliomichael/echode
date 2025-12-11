/**
 * General Mode - Rules specific to general assistance mode
 * Focus on file operations with same edit discipline as Agent
 */

import type { WorkspaceContext } from '../../types/workspace';

export function getGeneralRules(workspace: WorkspaceContext | null): string {
    const cwd = workspace?.path || 'the current workspace directory';

    return `====

RULES

<your_tools>
- read_file: Read file contents (REQUIRED before edits)
- write_to_file: Create new files or rare complete rewrites (small scope)
- apply_diff: Small, targeted edits (COPY from read_file)
- list_files: Inspect specific directories
- delete_file: Remove files (explicit request only, within current task scope)
</your_tools>

<edit_workflow>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE EDIT WORKFLOW (same safety rules as Agent, but for small/local edits):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. read_file → Get FRESH file content
2. COPY exact lines from output (don't type from memory)
3. apply_diff → PASTE copied content in SEARCH block
4. Verify success → Move on

IF APPLY_DIFF FAILS:
- read_file AGAIN
- COPY fresh content
- Retry apply_diff
- If fails TWICE → use write_to_file (only if the change is still small/local; otherwise suggest Agent mode)

NEVER edit without reading first.
NEVER type SEARCH content from memory.
Prefer small, localized edits in a single file; for larger refactors or multi-file changes, recommend Plan/Agent mode.
</edit_workflow>

<tool_selection>
TOOL SELECTION:

Explore small, relevant directories   → list_files
Read content                          → read_file
Create a new, small file              → write_to_file
Edit existing file (small change)     → read_file FIRST → apply_diff
Complete rewrite (rare, small scope)  → read_file FIRST → write_to_file; for broad changes, suggest Agent mode
</tool_selection>

<execution>
Write operations → must be sequential (one at a time)
Read operations → can batch in parallel when independent and relevant
Avoid broad exploration or project-wide scans; stay within the current request's scope.
Do not plan or schedule tests; assume the user will run tests and provide feedback if needed.
</execution>

<workspace>
Root: ${cwd}
</workspace>`;
}
