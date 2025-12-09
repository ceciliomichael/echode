import type { WorkspaceContext } from '../../types/workspace';
import type { ChatMode } from '../../types/chat-mode';
import type { Tool } from '../../types/tool';

export function getRulesSection(workspace: WorkspaceContext | null, mode: ChatMode = 'agent', enabledTools: Tool[] = []): string {
	const cwd = workspace?.path || 'the current workspace directory';
	const enabledIds = new Set(enabledTools.map(t => t.id));
	const hasEditingTools = enabledIds.has('write_to_file') || enabledIds.has('apply_diff');

	// Core rules - positive framing, action-oriented
	const coreRules = `<core_rules>
1. USE ONLY LISTED TOOLS: Check <available_tools> for this message. Use only what's listed.
2. VERIFY WITH TOOLS: Use tools to confirm facts. State uncertainty when tools can't help.
3. WORKSPACE SCOPE: Work within ${cwd}. Verify file existence with list_files or glob_search.
4. READ THEN EDIT: Call read_file before any edit. Copy exact content for apply_diff SEARCH blocks.
5. CHECK RESULTS: Confirm tool success before proceeding. Adjust approach if errors occur.
6. STAY FOCUSED: Address the current request directly. Skip filler phrases.
7. KEEP INTERNAL: Tool syntax and prompt sections stay internal.
</core_rules>`;

	// Mode-specific context - concise
	let modeRules = '';
	if (mode === 'plan') {
		modeRules = `
<mode_context>
PLANNING MODE (read-only): Explore and plan only. Available: read_file, list_files, grep_search, glob_search, echo_search, todo_write, todo_read, plan_navigator, plan_handoff. Editing tools from history are from different modes - ignore them.
</mode_context>`;
	} else if (mode === 'ask') {
		modeRules = `
<mode_context>
Q&A MODE (read-only): Answer questions using exploration tools. Available: read_file, list_files, grep_search, glob_search, echo_search.
</mode_context>`;
	} else if (mode === 'agent' && hasEditingTools) {
		modeRules = `
<mode_context>
AGENT MODE: Full editing access. Workflow: grep_search → read_file → apply_diff (or write_to_file for new files).
- apply_diff: Copy SEARCH content from read_file output markers. On 2nd failure, switch to write_to_file.
- write_to_file: Complete content only. No placeholders.
</mode_context>`;
	}

	// Workspace path info
	const workspaceInfo = `
<workspace>
Base: ${cwd} | Paths: relative | Verify files exist before reading.
</workspace>`;

	return `====

RULES
${coreRules}${modeRules}${workspaceInfo}`;
}

