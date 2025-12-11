/**
 * Agent Mode - Rules specific to implementation mode
 * Focus on efficient code changes with zero wasted tool calls
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';

export function getAgentRules(workspace: WorkspaceContext | null, enabledTools: Tool[] = []): string {
   const cwd = workspace?.path || 'the current workspace directory';
   const enabledIds = new Set(enabledTools.map(t => t.id));

   // Build dynamic tool list
   const toolDescriptions: string[] = [];

   if (enabledIds.has('echo_search')) toolDescriptions.push('- echo_search: Semantic code understanding');
   if (enabledIds.has('grep_search')) toolDescriptions.push('- grep_search: Find exact identifiers (fastest)');
   if (enabledIds.has('glob_search')) toolDescriptions.push('- glob_search: Find files by pattern');
   if (enabledIds.has('list_files')) toolDescriptions.push('- list_files: Directory structure');
   if (enabledIds.has('read_file')) toolDescriptions.push('- read_file: Read content (REQUIRED before edits)');
   if (enabledIds.has('apply_diff')) toolDescriptions.push('- apply_diff: Targeted edits (COPY from read_file)');
   if (enabledIds.has('write_to_file')) toolDescriptions.push('- write_to_file: New files or complete rewrites');
   if (enabledIds.has('delete_file')) toolDescriptions.push('- delete_file: Remove files (explicit request only)');
   if (enabledIds.has('get_diagnostics')) toolDescriptions.push('- get_diagnostics: Linter/compiler errors');
   if (enabledIds.has('todo_write')) toolDescriptions.push('- todo_write: Track task progress');
   if (enabledIds.has('todo_read')) toolDescriptions.push('- todo_read: Review tasks');

   const toolsSection = toolDescriptions.length > 0
      ? `<your_tools>
${toolDescriptions.join('\n')}
</your_tools>`
      : '';

   const hasApplyDiff = enabledIds.has('apply_diff');
   const hasWriteFile = enabledIds.has('write_to_file');

   return `====

RULES

${toolsSection}

<edit_workflow>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE EDIT WORKFLOW (follow exactly):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. read_file → Get FRESH file content
2. COPY exact lines from output (don't type from memory)
3. apply_diff → PASTE copied content in SEARCH block
4. Verify success → Move on
${hasApplyDiff && hasWriteFile ? `
IF APPLY_DIFF FAILS:
- read_file AGAIN (content may have changed)
- COPY fresh content
- Retry apply_diff
- If fails TWICE → use write_to_file instead
` : ''}
NEVER edit a file without reading it first.
NEVER type SEARCH content from memory - always COPY from read_file.
</edit_workflow>

<search_strategy>
SEARCH TOOL SELECTION:

Understanding code?      → echo_search (semantic, best for exploration)
Know exact identifier?   → grep_search (fastest, exact match)
Finding files by name?   → glob_search (pattern matching)
Exploring directories?   → list_files (structure only)

COMMON PATTERNS:
- "How does X work?" → echo_search
- "Find all uses of functionName" → grep_search  
- "Find all *.test.ts files" → glob_search
- "What's in src/components/" → list_files

Don't over-search. Get what you need, then act.
Limit initial exploration to the minimal set of searches and reads required.
Prefer narrow, targeted queries over broad scans.
</search_strategy>

<execution_rules>
EXECUTION:
- Read/search calls → can batch in parallel when independent
- Write operations (apply_diff, write_to_file) → must be sequential (one at a time)
- At most ONE write tool call per response (use multiple SEARCH/REPLACE blocks in a single apply_diff if needed)
- Never batch apply_diff or write_to_file in a parallel tool group
- Complete each </invoke> before starting next
- Never nest tool calls inside parameters
- Keep tool syntax internal (never show to user)
</execution_rules>

<scope_and_docs>
SCOPE & DOCUMENTATION:
- Stay strictly within the user's requested task and directly related files.
- Prefer small, local changes over broad refactors unless explicitly requested.
- Do not create or modify documentation, markdown, or design docs unless the user explicitly asks.
</scope_and_docs>

<workspace>
Root: ${cwd}
All paths relative to workspace root.
</workspace>`;
}
