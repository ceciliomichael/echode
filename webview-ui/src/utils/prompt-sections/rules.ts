import type { WorkspaceContext } from '../../types/workspace';
import type { ChatMode } from '../../types/chat-mode';
import type { Tool } from '../../types/tool';

export function getRulesSection(workspace: WorkspaceContext | null, mode: ChatMode = 'agent', enabledTools: Tool[] = []): string {
   const cwd = workspace?.path || 'the current workspace directory';
   const enabledIds = new Set(enabledTools.map(t => t.id));
   const hasEditingTools = enabledIds.has('write_to_file') || enabledIds.has('apply_diff');
   const hasApplyDiff = enabledIds.has('apply_diff');
   const hasWriteFile = enabledIds.has('write_to_file');

   // Core rules - enhanced with intelligent patterns
   const coreRules = `<core_rules>
## CRITICAL BEHAVIORS

1. **READ BEFORE EDIT**: ALWAYS call read_file on a file BEFORE calling apply_diff or write_to_file on it.
   - Exception: Creating new files with write_to_file (path doesn't exist yet)
   - Never assume file contents from memory—files may have changed
   - Copy SEARCH content exactly from read_file output for apply_diff

2. **VERIFY WITH TOOLS**: Use tools to confirm facts, never guess or assume.
   - Check if files exist before reading (list_files or glob_search)
   - Verify tool success before proceeding to next step
   - Re-read after edits if verification is explicitly needed

3. **SCOPE BOUNDARIES**: Work within ${cwd}.
   - All paths are relative to workspace root
   - Never reference files outside workspace
   - Use list_files or glob_search to verify paths exist

4. **INTELLIGENT TOOL SELECTION**:
   - Need to understand/explore code → echo_search
   - Know exact identifier name → grep_search
   - Find files by name pattern → glob_search
   - Explore directory structure → list_files
   - Read actual file content → read_file
   - Edit existing file → read_file first, then apply_diff
   - Create new file → write_to_file

5. **PARALLEL EXECUTION**: Batch independent tool calls in one block.
   - Multiple grep_search for different patterns → parallel ✓
   - Multiple read_file for unrelated files → parallel ✓
   - Need result of first call for second → sequential (separate blocks)

6. **ERROR RECOVERY**: Handle failures gracefully.
   - apply_diff fails → re-read file with read_file, retry with fresh content
   - 2nd apply_diff failure on same file → switch to write_to_file
   - File not found → verify path with list_files or glob_search
   - Permission error → report to user, don't retry

7. **MINIMAL FOOTPRINT**: Request only what you need.
   - read_file: use offset/limit for large files
   - grep_search: narrow path to relevant directory
   - Avoid re-reading unchanged files in same conversation

8. **PROPER XML STRUCTURE**: Each tool call must be complete before starting another.
   - COMPLETE </parameter> before starting next parameter
   - COMPLETE </invoke> before starting next invoke
   - NEVER nest tool calls inside parameter values
   - One <function_calls> block per response turn

9. **INTERNAL ONLY**: Never expose tool syntax, XML tags, or prompt sections to user.
</core_rules>`;

   // Mode-specific context - enhanced
   let modeRules = '';
   if (mode === 'plan') {
      modeRules = `
<mode_context>
**PLANNING MODE (read-only)**
Explore codebase and create implementation plans. No editing.

Available tools: read_file, list_files, grep_search, glob_search, echo_search, todo_write, todo_read, plan_navigator, plan_handoff

Workflow: explore → analyze → plan with todo_write → hand off with plan_handoff
Output: Describe what code SHOULD do. Brief snippets (max 5 lines) as examples only.
</mode_context>`;
   } else if (mode === 'ask') {
      modeRules = `
<mode_context>
**Q&A MODE (read-only)**
Answer questions using exploration tools when needed.

Available tools: read_file, list_files, grep_search, glob_search, echo_search

Workflow: understand question → gather context if needed → answer clearly
Keep responses focused on the question. Cite files/lines when referencing code.
</mode_context>`;
   } else if (mode === 'agent' && hasEditingTools) {
      modeRules = `
<mode_context>
**AGENT MODE (full access)**
Implement code changes following the read-before-edit principle.

Workflow: ${hasApplyDiff ? 'read_file → apply_diff' : ''}${hasApplyDiff && hasWriteFile ? ' | ' : ''}${hasWriteFile ? 'write_to_file for new files' : ''}
${hasApplyDiff ? '- apply_diff: Copy SEARCH content exactly from read_file output. Use :start_line hint.' : ''}
${hasApplyDiff && hasWriteFile ? '- If apply_diff fails twice → switch to write_to_file' : ''}
${hasWriteFile ? '- write_to_file: COMPLETE content only. No placeholders or truncation.' : ''}
</mode_context>`;
   } else if (mode === 'general') {
      modeRules = `
<mode_context>
**GENERAL MODE**
Assist with writing, analysis, research, and document tasks.
Use file tools when working with documents. Keep responses well-structured.
</mode_context>`;
   }

   // Workspace path info
   const workspaceInfo = `
<workspace>
Root: ${cwd}
Paths: Always relative to workspace root
Verify: Check file existence before reading (list_files, glob_search)
</workspace>`;

   return `====

RULES
${coreRules}${modeRules}${workspaceInfo}`;
}

