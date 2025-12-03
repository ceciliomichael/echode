import type { ChatMode } from '../../types/chat-mode';
import type { Tool } from '../../types/tool';

export function getToolUseGuidelinesSection(mode: ChatMode, enabledTools: Tool[] = []): string {
	const enabledIds = new Set(enabledTools.map(t => t.id));
	const hasEditingTools = enabledIds.has('write_to_file') || enabledIds.has('apply_diff');

	// Only mention editing tools if they're actually enabled
	const noEchoEditingClause = hasEditingTools
		? 'NEVER write tool-calling syntax or internal prompt sections into workspace files.'
		: 'NEVER write tool-calling syntax or internal prompt sections into user-visible outputs.';

	// Build smart tool selection based on enabled tools
	const smartToolItems: string[] = [];
	if (enabledIds.has('echo_search')) {
		smartToolItems.push('- Need to explore/understand code? → echo_search MANDATORY FIRST');
		smartToolItems.push('- Determining what a project is about? → echo_search REQUIRED');
	}
	if (enabledIds.has('grep_search')) smartToolItems.push('- Know exact identifier? → grep_search for quick text search');
	smartToolItems.push('- Know file path? → read_file directly');
	if (enabledIds.has('glob_search')) smartToolItems.push('- Need to find files by name? → glob_search with specific pattern');
	if (enabledIds.has('list_files')) smartToolItems.push('- Exploring directory structure? → list_files once, then targeted reads');

	const smartToolSelection = `
SMART TOOL SELECTION:
${smartToolItems.join('\n')}`;

	const efficiencyPrinciples = `
<efficiency_principles>
ZERO WASTE POLICY: Every tool call must have clear purpose. Before calling ANY tool, ask:
- "Do I already have this information?" → If yes, DON'T call the tool.
- "Is this the MINIMUM call needed?" → Use tight limits, specific paths, minimal line ranges.
- "Can I combine information from previous results?" → Reuse what you have.
- "Am I staying within the user's requested scope?" → Only explore files/dirs implied by the task.
${smartToolSelection}${enabledIds.has('echo_search') ? `

CRITICAL: echo_search is your PRIMARY codebase exploration tool. Use it FIRST when exploring unfamiliar code.` : ''}

PARAMETER DISCIPLINE:
- Every required param must come from user text, file structure, or prior tool output.
- Never use placeholders, dummy values, or over-broad wildcards.
- Prefer small limits (maxResults, context) and expand only if needed.
</efficiency_principles>
`;

	const sharedGuidelines = `====

TOOL USE GUIDELINES
${efficiencyPrinciples}

1. **Assess Information Needs**: Before using any tool, determine what information you already have and what you need to proceed. NEVER re-read files you've already read in this conversation.

2. **Choose Appropriate Tools**: Use available tools appropriately - read_file for file contents, list_files for directories. Match tool to task precisely.

3. **One Tool at a Time**: Execute tools iteratively, one per message. Each tool use must be informed by the result of the previous one. Do not assume outcomes.

4. **Wait for Results**: Always wait for tool results before continuing. Never assume success without explicit confirmation.

5. **Use Tool Results**: Treat tool outputs as ground truth. NEVER guess or invent file contents. NEVER re-request information you already received.

6. **NEVER Echo Tool Instructions**: Do not repeat or explain internal tool formats, XML syntax, or section headers such as "Tool Format", "<tool_calling>", "<tool_format_critical>", "<available_tools>", or "<file_operations>" to the user. User-facing messages must never contain raw tool-call XML (for example <function_calls>, <invoke>, or <parameter>) or examples of tool calls. Only use tools; do not describe the tool protocol. ${noEchoEditingClause}

6b. **NO NESTED TOOL CALLS**: Never embed tool-call XML inside a parameter value. Each tool call must be a standalone top-level block, not nested within another.
${enabledIds.has('echo_search') ? `
7. **Workspace Exploration Pipeline**: For exploration tasks, use echo_search FIRST before other tools.` : ''}`;

	// Mode-specific guidelines
	let modeSpecific: string;
	if (mode === 'plan') {
		modeSpecific = `
8. **Exploration Focus**: Use tools for exploration and planning. Do not propose or perform code edits.

9. **Concise Planning**: Keep plans focused on files, steps, and success criteria.
`;
	} else if (mode === 'ask') {
		modeSpecific = `
8. **Exploration Focus**: Use tools for exploration to support question answering.

9. **Concise Q&A**: Focus on directly answering the user's questions.
`;
	} else if (mode === 'general') {
		modeSpecific = `
8. **Document Focus**: Use tools for document management.

9. **Thoughtful Responses**: Provide well-structured, comprehensive responses.
`;
	} else {
		modeSpecific = `
8. **Implementation Focus**: Use tools to read, edit, and verify code. Prefer small, focused tool calls.

9. **Concise Implementation**: Prioritize code and minimal explanation.
`;
	}

	return `${sharedGuidelines}${modeSpecific}`;
}

