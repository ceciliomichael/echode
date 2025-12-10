/**
 * General Mode - Rules specific to general assistance mode
 * ONLY references tools that exist in General mode
 */

import type { WorkspaceContext } from '../../types/workspace';

export function getGeneralRules(workspace: WorkspaceContext | null): string {
    const cwd = workspace?.path || 'the current workspace directory';

    return `====

RULES

<general_mode_tools>
YOUR AVAILABLE TOOLS:
- read_file: Read file contents
- write_to_file: Create new files or completely rewrite existing ones
- apply_diff: Make targeted edits to existing files
- list_files: Explore directory structure
- delete_file: Remove files (only when explicitly requested)
- echo_search: Understand code semantically (best for exploration)
- grep_search: Find exact text/identifiers in code
- glob_search: Find files by name pattern
</general_mode_tools>

<workflow>
GENERAL WORKFLOW:
1. UNDERSTAND: Parse the user's request
2. READ: Always read_file before editing existing files
3. EDIT: Use apply_diff for targeted changes, write_to_file for new/complete rewrites
4. VERIFY: Confirm success before moving on

OUTPUT FORMAT:
- Clear, well-structured prose
- Adjust formality to context
- Complete content in file operations (no placeholders)
</workflow>

<tool_selection>
TOOL SELECTION:
- Need to understand code → echo_search (semantic) or grep_search (exact match)
- Explore directories → list_files
- Find files by pattern → glob_search
- Read file contents → read_file
- Create new file → write_to_file
- Edit existing file → read_file FIRST, then apply_diff
- Complete rewrite → write_to_file (after reading)
- Remove file → delete_file (only when user explicitly asks)

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

<editing_rules>
EDITING RULES:
- READ BEFORE EDIT: Always read_file before modifying
- apply_diff: Copy SEARCH content exactly from read_file output
- If apply_diff fails twice → use write_to_file instead
- write_to_file: Provide COMPLETE content, no placeholders
</editing_rules>

<workspace>
WORKSPACE:
Root: ${cwd}
All paths are relative to workspace root.
</workspace>

<execution_rules>
EXECUTION:
- Batch independent read calls in one <function_calls> block
- Write operations must be sequential (one at a time)
- Complete each </invoke> before starting the next
- Never nest tool calls inside parameters
- Keep tool syntax internal (never show to user)
</execution_rules>`;
}
