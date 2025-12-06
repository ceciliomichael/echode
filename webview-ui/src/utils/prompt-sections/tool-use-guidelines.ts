import type { ChatMode } from '../../types/chat-mode';
import type { Tool } from '../../types/tool';

// Read-only tools safe for parallel execution
const READ_ONLY_TOOLS = new Set([
	'read_file',
	'list_files',
	'grep_search',
	'glob_search',
	'echo_search',
	'todo_read',
]);

// Mutating tools that must run sequentially
const MUTATING_TOOLS = new Set([
	'write_to_file',
	'apply_diff',
	'delete_file',
	'todo_write',
	'execute_command',
]);

export function getToolUseGuidelinesSection(mode: ChatMode, enabledTools: Tool[] = []): string {
	const enabledIds = new Set(enabledTools.map(t => t.id));
	const hasEditingTools = enabledIds.has('write_to_file') || enabledIds.has('apply_diff');

	// Build tool selection guide based on enabled tools
	const toolSelectionItems: string[] = [];
	if (enabledIds.has('echo_search')) {
		toolSelectionItems.push('- Explore/understand code: echo_search first');
	}
	if (enabledIds.has('grep_search')) {
		toolSelectionItems.push('- Know exact identifier: grep_search');
	}
	toolSelectionItems.push('- Know file path: read_file directly');
	if (enabledIds.has('glob_search')) {
		toolSelectionItems.push('- Find files by name: glob_search');
	}
	if (enabledIds.has('list_files')) {
		toolSelectionItems.push('- Explore structure: list_files once, then targeted reads');
	}

	const noProtocolLeak = hasEditingTools
		? 'Never write tool-call syntax into workspace files.'
		: 'Never expose tool-call syntax in outputs.';

	// Determine which read-only and mutating tools are enabled
	const enabledReadOnly = enabledTools.filter(t => READ_ONLY_TOOLS.has(t.id)).map(t => t.id);
	const enabledMutating = enabledTools.filter(t => MUTATING_TOOLS.has(t.id)).map(t => t.id);

	// Build parallelization section only if relevant tools exist
	let parallelSection = '';
	if (enabledReadOnly.length > 0) {
		parallelSection = `

<parallel_tool_calls>
WHEN TO PARALLELIZE:
- You MAY batch multiple independent tool calls in one response when ALL are read-only.
- Read-only tools: ${enabledReadOnly.join(', ')}
- Good for: gathering context from multiple files/searches simultaneously.

WHEN NOT TO PARALLELIZE:
- NEVER parallelize mutating tools${enabledMutating.length > 0 ? ` (${enabledMutating.join(', ')})` : ''}.
- NEVER parallelize when one call depends on another's result.
- NEVER parallelize when debugging a failing tool; run one at a time.

HOW TO PARALLELIZE:
- Output multiple <function_calls> blocks in sequence (one per tool).
- The system executes read-only calls in parallel automatically.
- Wait for all results before deciding next action.
</parallel_tool_calls>`;
	}

	const coreGuidelines = `====

TOOL USE GUIDELINES

<tool_selection>
${toolSelectionItems.join('\n')}
</tool_selection>

<core_rules>
Please follow these rules:
1. Trust tool results. Never guess file contents or paths.
2. Do not re-read files. If you saw it earlier, reuse that content.
3. Keep tool syntax internal. ${noProtocolLeak}
4. One tool call per block. Never nest tool XML inside parameters.
5. Check results before proceeding. Verify each tool succeeded.
6. Read before edit. Always read_file before apply_diff or write_to_file.
</core_rules>${parallelSection}`;

	// Mode-specific additions - focused on workflow, not tool restrictions
	let modeGuidelines: string;
	if (mode === 'plan') {
		modeGuidelines = `

<mode_workflow>
- Explore codebase to understand structure and identify files to modify.
- Draft high-level plan with files, steps, and success criteria.
- Use todo_write to persist the plan.
</mode_workflow>`;
	} else if (mode === 'ask') {
		modeGuidelines = `

<mode_workflow>
- Use tools only when the answer requires codebase context.
- Focus on directly answering questions with accurate information.
</mode_workflow>`;
	} else if (mode === 'general') {
		modeGuidelines = `

<mode_workflow>
- Use tools for document management when needed.
- Provide well-structured, comprehensive responses.
</mode_workflow>`;
	} else {
		modeGuidelines = `

<mode_workflow>
- Follow any existing implementation plan.
- Make focused, incremental changes matching existing patterns.
- Run get_diagnostics before declaring implementation complete.
</mode_workflow>`;
	}

	return `${coreGuidelines}${modeGuidelines}`;
}

