import type { ChatMode } from '../../types/chat-mode';
import type { Tool } from '../../types/tool';

export function getToolUseGuidelinesSection(mode: ChatMode, enabledTools: Tool[] = []): string {
	const enabledIds = new Set(enabledTools.map(t => t.id));
	const hasEditingTools = enabledIds.has('write_to_file') || enabledIds.has('apply_diff');

	// Build tool selection guide based on enabled tools
	const toolSelectionItems: string[] = [];
	if (enabledIds.has('echo_search')) {
		toolSelectionItems.push('• Explore/understand code? → **echo_search FIRST**');
	}
	if (enabledIds.has('grep_search')) {
		toolSelectionItems.push('• Know exact identifier? → grep_search');
	}
	toolSelectionItems.push('• Know file path? → read_file directly');
	if (enabledIds.has('glob_search')) {
		toolSelectionItems.push('• Find files by name? → glob_search');
	}
	if (enabledIds.has('list_files')) {
		toolSelectionItems.push('• Explore structure? → list_files once, then targeted reads');
	}

	const noProtocolLeak = hasEditingTools
		? 'NEVER write tool-call syntax into workspace files.'
		: 'NEVER expose tool-call syntax in outputs.';

	const coreGuidelines = `====

TOOL USE GUIDELINES

<tool_selection>
${toolSelectionItems.join('\n')}
</tool_selection>

CORE RULES:
1. **One tool per step** - Execute iteratively, wait for results before next call.
2. **Never re-read** - Don't request info you already have from this conversation.
3. **Results are truth** - Treat tool outputs as ground truth. Never guess or invent.
4. **No protocol leak** - ${noProtocolLeak} Never explain internal XML format.
5. **No nested calls** - Each tool call is a standalone block, never inside parameters.
6. **Verify success** - Wait for confirmation before proceeding to next step.`;

	// Mode-specific additions
	let modeGuidelines: string;
	if (mode === 'plan') {
		modeGuidelines = `

PLAN MODE:
- Use tools for exploration only. No code edits.
- Keep plans focused on files, steps, and success criteria.`;
	} else if (mode === 'ask') {
		modeGuidelines = `

ASK MODE:
- Use tools only when answer requires codebase context.
- Focus on directly answering questions.`;
	} else if (mode === 'general') {
		modeGuidelines = `

GENERAL MODE:
- Use tools for document management.
- Provide well-structured, comprehensive responses.`;
	} else {
		modeGuidelines = `

AGENT MODE:
- Use tools to read, edit, and verify code.
- Prefer small, focused tool calls.
- Run get_diagnostics before declaring implementation complete.`;
	}

	return `${coreGuidelines}${modeGuidelines}`;
}

