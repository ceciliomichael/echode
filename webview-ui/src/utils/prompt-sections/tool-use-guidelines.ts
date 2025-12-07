import type { ChatMode } from '../../types/chat-mode';
import type { Tool } from '../../types/tool';

// Tools that must run serially (non-parallelizable)
// Planning/todo helpers and destructive operations are always executed one at a time.
const SERIAL_ONLY_TOOLS = new Set<string>([
	'todo_write',
	'todo_read',
	'plan_navigator',
	'plan_handoff',
	'delete_file',
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

	// Determine which tools are serial-only vs parallelizable for guidance
	const enabledSerialOnly = enabledTools.filter(t => SERIAL_ONLY_TOOLS.has(t.id)).map(t => t.id);
	const enabledParallelizable = enabledTools
		.filter(t => !SERIAL_ONLY_TOOLS.has(t.id))
		.map(t => t.id);

	// Build parallelization section only if relevant tools exist
	let parallelSection = '';
	if (enabledParallelizable.length > 0) {
		parallelSection = `

<parallel_tool_calls>
WHEN TO PARALLELIZE:
- You MAY batch multiple independent tool calls in one response when ALL of them are parallelizable (non-planning, non-todo, non-destructive).
- Parallelizable tools: ${enabledParallelizable.join(', ')}
- Good for: gathering context from multiple files/searches or applying edits to multiple files efficiently.

WHEN NOT TO PARALLELIZE:
- NEVER parallelize serial-only tools${enabledSerialOnly.length > 0 ? ` (${enabledSerialOnly.join(', ')})` : ''}.
- NEVER parallelize when one call depends on another's result.
- NEVER parallelize when debugging a failing tool; run one at a time.

HOW TO PARALLELIZE:
- Use a single <function_calls> block containing multiple <invoke> tags, one per tool call.
- The system may execute parallelizable tools from that block in parallel automatically.
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
4. One tool call per <invoke> tag. You MAY include multiple <invoke> tags inside a single <function_calls> block when parallelizing, but never nest tool XML inside <parameter> values.
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

