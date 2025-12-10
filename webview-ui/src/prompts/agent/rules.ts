/**
 * Agent Mode - Rules specific to implementation mode
 * ONLY references tools that exist in Agent mode
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';

export function getAgentRules(workspace: WorkspaceContext | null, enabledTools: Tool[] = []): string {
   const cwd = workspace?.path || 'the current workspace directory';
   const enabledIds = new Set(enabledTools.map(t => t.id));

   // Build dynamic tool list based on what's actually enabled
   const toolDescriptions: string[] = [];

   // Search tools
   if (enabledIds.has('echo_search')) {
      toolDescriptions.push('- echo_search: Understand code semantically (best for exploration)');
   }
   if (enabledIds.has('grep_search')) {
      toolDescriptions.push('- grep_search: Find exact text/identifiers in code');
   }
   if (enabledIds.has('glob_search')) {
      toolDescriptions.push('- glob_search: Find files by name pattern');
   }
   if (enabledIds.has('list_files')) {
      toolDescriptions.push('- list_files: Explore directory structure');
   }

   // File operations
   if (enabledIds.has('read_file')) {
      toolDescriptions.push('- read_file: Read file contents (ALWAYS before editing)');
   }
   if (enabledIds.has('write_to_file')) {
      toolDescriptions.push('- write_to_file: Create new files or complete rewrites');
   }
   if (enabledIds.has('apply_diff')) {
      toolDescriptions.push('- apply_diff: Make targeted edits to existing files');
   }
   if (enabledIds.has('delete_file')) {
      toolDescriptions.push('- delete_file: Remove files (only when explicitly requested)');
   }

   // Diagnostics
   if (enabledIds.has('get_diagnostics')) {
      toolDescriptions.push('- get_diagnostics: Get linter/compiler errors and warnings');
   }

   // Task management
   if (enabledIds.has('todo_write')) {
      toolDescriptions.push('- todo_write: Track task progress');
   }
   if (enabledIds.has('todo_read')) {
      toolDescriptions.push('- todo_read: Review current tasks');
   }

   const toolsSection = toolDescriptions.length > 0
      ? `<agent_mode_tools>
YOUR AVAILABLE TOOLS:
${toolDescriptions.join('\n')}
</agent_mode_tools>`
      : '';

   // Build editing rules only if editing tools are available
   const hasApplyDiff = enabledIds.has('apply_diff');
   const hasWriteFile = enabledIds.has('write_to_file');
   const hasReadFile = enabledIds.has('read_file');

   const editingSection = (hasApplyDiff || hasWriteFile) && hasReadFile
      ? `
<editing_rules>
CRITICAL EDITING WORKFLOW:
1. read_file FIRST → get current content
2. ${hasApplyDiff ? 'apply_diff → targeted edits (copy SEARCH exactly from read_file output)' : 'write_to_file → provide complete new content'}
3. Verify success → move on
${hasApplyDiff && hasWriteFile ? `
FALLBACK:
- If apply_diff fails twice → use write_to_file instead
` : ''}
NEVER edit a file without reading it first.
</editing_rules>`
      : '';

   return `====

RULES

${toolsSection}

<workflow>
AGENT WORKFLOW:
1. EXPLORE: Understand what needs to be done
2. READ: Get current file contents before any edits
3. EDIT: Make targeted changes
4. VERIFY: Confirm success before moving on
</workflow>

<tool_selection>
TOOL SELECTION:
- Need to understand code → echo_search (semantic) or grep_search (exact match)
- Explore directory structure → list_files
- Find files by pattern → glob_search
- Read specific file → read_file
- Create new file → write_to_file
- Edit existing file → read_file FIRST, then apply_diff
- Complete rewrite → write_to_file (after reading)
- Check for errors → get_diagnostics

SEARCH TOOL BALANCE:
- echo_search: Great for initial exploration and understanding code semantics
- grep_search: Best for finding exact identifiers, function names, specific strings
- glob_search: Best for finding files by name pattern

Don't over-rely on echo_search:
- Use it to START exploration and understand unfamiliar areas
- Switch to grep_search when you know the exact identifier
- Use glob_search when finding files by name/extension
- Use read_file when you already know the file to examine
</tool_selection>
${editingSection}

<workspace>
WORKSPACE:
Root: ${cwd}
All paths are relative to workspace root.
Verify file existence with list_files or glob_search before reading.
</workspace>

<execution_rules>
EXECUTION:
- Batch independent read/search calls in one <function_calls> block
- Write operations must be sequential (one at a time)
- Complete each </invoke> before starting the next
- Never nest tool calls inside parameters
- Keep tool syntax internal (never show to user)
</execution_rules>`;
}
