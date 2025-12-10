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
- write_to_file: Create new files or complete rewrites
- apply_diff: Targeted edits (COPY from read_file)
- list_files: Directory structure
- delete_file: Remove files (explicit request only)
</your_tools>

<edit_workflow>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE EDIT WORKFLOW (same as Agent mode):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. read_file → Get FRESH file content
2. COPY exact lines from output (don't type from memory)
3. apply_diff → PASTE copied content in SEARCH block
4. Verify success → Move on

IF APPLY_DIFF FAILS:
- read_file AGAIN
- COPY fresh content
- Retry apply_diff
- If fails TWICE → use write_to_file

NEVER edit without reading first.
NEVER type SEARCH content from memory.
</edit_workflow>

<tool_selection>
TOOL SELECTION:

Explore directories   → list_files
Read content          → read_file
Create new file       → write_to_file
Edit existing file    → read_file FIRST → apply_diff
Complete rewrite      → read_file FIRST → write_to_file
</tool_selection>

<execution>
Write operations → must be sequential (one at a time)
Read operations → can batch in parallel
</execution>

<workspace>
Root: ${cwd}
</workspace>`;
}
