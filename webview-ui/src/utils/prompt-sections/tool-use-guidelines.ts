import type { ChatMode } from '../../types/chat-mode';
import type { Tool } from '../../types/tool';
import { PARALLEL_ALLOWED_TOOLS } from '../../lib/tool-parallel-config';

export function getToolUseGuidelinesSection(_mode: ChatMode, enabledTools: Tool[] = []): string {
	const enabledIds = new Set(enabledTools.map(t => t.id));

	// Tool selection - concise decision tree
	const selectionItems: string[] = [];
	if (enabledIds.has('echo_search')) selectionItems.push('Explore codebase → echo_search');
	if (enabledIds.has('grep_search')) selectionItems.push('Find identifier → grep_search');
	if (enabledIds.has('glob_search')) selectionItems.push('Find by filename → glob_search');
	if (enabledIds.has('list_files')) selectionItems.push('Browse structure → list_files');
	selectionItems.push('Known path → read_file');

	// Parallel tools guidance - only tools in PARALLEL_ALLOWED_TOOLS can be batched
	const parallelizable = enabledTools.filter(t => PARALLEL_ALLOWED_TOOLS.has(t.id));
	const serialOnly = enabledTools.filter(t => !PARALLEL_ALLOWED_TOOLS.has(t.id));
	const parallelSection = parallelizable.length > 1
		? `
<parallel_calls>
ONLY these tools can be batched in parallel: ${[...PARALLEL_ALLOWED_TOOLS].filter(id => enabledIds.has(id)).join(', ') || 'none'}.
All other tools MUST run one at a time. Serial-only: ${serialOnly.map(t => t.id).join(', ') || 'none enabled'}.
</parallel_calls>`
		: '';

	return `====

TOOL GUIDANCE

<when_to_use>
${selectionItems.join(' | ')}
</when_to_use>

<tool_format>
**STRUCTURE REQUIREMENTS:**
- One <function_calls> block per response
- Each tool in separate <invoke> tag
- CLOSE </parameter> before next parameter
- CLOSE </invoke> before next invoke
- NEVER nest invokes inside parameter values
</tool_format>${parallelSection}`;
}

