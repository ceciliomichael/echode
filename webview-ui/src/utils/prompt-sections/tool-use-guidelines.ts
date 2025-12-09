import type { ChatMode } from '../../types/chat-mode';
import type { Tool } from '../../types/tool';

// Tools that must run serially (non-parallelizable)
const SERIAL_ONLY_TOOLS = new Set<string>([
	'todo_write',
	'todo_read',
	'plan_navigator',
	'plan_handoff',
	'delete_file',
	'execute_command',
]);

export function getToolUseGuidelinesSection(_mode: ChatMode, enabledTools: Tool[] = []): string {
	const enabledIds = new Set(enabledTools.map(t => t.id));

	// Tool selection - concise decision tree
	const selectionItems: string[] = [];
	if (enabledIds.has('echo_search')) selectionItems.push('Explore codebase → echo_search');
	if (enabledIds.has('grep_search')) selectionItems.push('Find identifier → grep_search');
	if (enabledIds.has('glob_search')) selectionItems.push('Find by filename → glob_search');
	if (enabledIds.has('list_files')) selectionItems.push('Browse structure → list_files');
	selectionItems.push('Known path → read_file');

	// Parallel tools guidance - only if multiple parallelizable tools exist
	const parallelizable = enabledTools.filter(t => !SERIAL_ONLY_TOOLS.has(t.id));
	const parallelSection = parallelizable.length > 1
		? `
<parallel_calls>
Batch independent calls in one <function_calls> block. Serial-only: ${[...SERIAL_ONLY_TOOLS].filter(id => enabledIds.has(id)).join(', ') || 'none enabled'}.
</parallel_calls>`
		: '';

	return `====

TOOL GUIDANCE

<when_to_use>
${selectionItems.join(' | ')}
</when_to_use>

<tool_format>
One <function_calls> block per response. Each tool in separate <invoke> tag. Close </invoke> before starting next.
</tool_format>${parallelSection}`;
}

