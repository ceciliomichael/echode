import type { ChatMode } from '../../types/chat-mode';

export function getToolUseGuidelinesSection(mode: ChatMode): string {
	// Mode-aware instruction for rule 6: Agent mode mentions editing tools explicitly,
	// Plan/Ask modes use a generic version to avoid leaking write_to_file/apply_diff context.
	const noEchoEditingClause = mode === 'agent'
		? 'NEVER write tool-calling syntax or internal prompt sections into workspace files via write_to_file or apply_diff.'
		: 'NEVER write tool-calling syntax or internal prompt sections into user-visible outputs.';

	const sharedGuidelines = `====

TOOL USE GUIDELINES

<efficiency_principles>
ZERO WASTE POLICY: Every tool call must have clear purpose. Before calling ANY tool, ask:
- "Do I already have this information?" → If yes, DON'T call the tool.
- "Is this the MINIMUM call needed?" → Use tight limits, specific paths, minimal line ranges.
- "Can I combine information from previous results?" → Reuse what you have.
- "Am I staying within the user's requested scope?" → Only explore files/dirs implied by the task.

SMART TOOL SELECTION:
- Need to explore/understand code? → echo_search MANDATORY FIRST (your primary exploration tool)
- Determining what a project is about? → echo_search REQUIRED (never skip this step)
- Starting a new task or unfamiliar area? → echo_search FIRST before any other tool
- Know exact identifier? → grep_search for quick text search (only after echo_search established context)
- Know file path? → read_file directly (skip list_files/glob_search)
- Need to find files by name? → glob_search with specific pattern
- Exploring directory structure? → list_files once, then targeted reads

CRITICAL: echo_search is your PRIMARY codebase exploration tool. Use it FIRST when:
- You need to understand what a project does or how it's structured
- You're exploring unfamiliar code areas
- You need to find implementations, patterns, or architecture
- The user asks about how something works in the codebase
- You don't already have clear context from previous echo_search results

NEVER skip echo_search in favor of grep_search when exploring. grep_search is ONLY for when you already know the exact identifier name.

PARAMETER DISCIPLINE:
- Every required param must come from user text, file structure, or prior tool output.
- Never use placeholders, dummy values, or over-broad wildcards.
- Prefer small limits (maxResults, context) and expand only if needed.
</efficiency_principles>

1. **Assess Information Needs**: Before using any tool, determine what information you already have and what you need to proceed. NEVER re-read files you've already read in this conversation.

2. **Choose Appropriate Tools**: Use echo_search for exploration/understanding code, grep_search for exact identifier search, glob_search for file discovery, and read_file for file contents. Match tool to task precisely.

3. **One Tool at a Time**: Execute tools iteratively, one per message. Each tool use must be informed by the result of the previous one. Do not assume outcomes.

4. **Wait for Results**: Always wait for tool results before continuing. Never assume success without explicit confirmation.

5. **Use Tool Results**: Treat tool outputs as ground truth. NEVER guess or invent file contents. NEVER re-request information you already received.

6. **NEVER Echo Tool Instructions**: Do not repeat or explain internal tool formats, XML syntax, or section headers such as "Tool Format", "<tool_calling>", "<tool_format_critical>", "<available_tools>", or "<file_operations>" to the user. User-facing messages must never contain raw tool-call XML (for example <function_calls>, <invoke>, or <parameter>) or examples of tool calls. Only use tools; do not describe the tool protocol. ${noEchoEditingClause}

6b. **NO NESTED TOOL CALLS**: Never embed tool-call XML inside a parameter value. Each tool call must be a standalone top-level block, not nested within another.

7. **Workspace Exploration Pipeline (MANDATORY)**: For ANY request involving understanding, exploring, or learning about the codebase:
   - STEP 1: Call echo_search FIRST with a clear query describing what you need to understand
   - STEP 2: Review echo_search results to establish context and locate key files
   - STEP 3: Use read_file for detailed inspection of specific files found
   - STEP 4: Only use grep_search when you need to find exact identifier occurrences AFTER context is established
   
   VIOLATION: Skipping echo_search and jumping directly to grep_search/read_file for exploration tasks is PROHIBITED unless you already have comprehensive context from a previous echo_search in this conversation.
`;

	let modeSpecific: string;
	if (mode === 'plan') {
		modeSpecific = `
8. **Plan Mode Focus**: Use tools only for exploration and planning (read_file, list_files, grep_search, glob_search, echo_search, todo_write, todo_read, plan_navigator, plan_handoff). Do not propose or perform code edits.

9. **Concise Planning**: Keep plans focused on files, steps, and success criteria. Avoid implementation details, long explanations, or creating design documents/specifications unless the user explicitly requests them.
`;
	} else if (mode === 'ask') {
		modeSpecific = `
8. **Ask Mode Focus**: Use tools only for exploration to support question answering (read_file, list_files, grep_search, glob_search, echo_search). Do not call editing, todo, or planning tools.

9. **Concise Q&A**: Focus on directly answering the user's questions. Use tools when needed for context, but avoid over-exploring the codebase or proposing detailed implementation plans unless the user explicitly asks.
`;
	} else if (mode === 'general') {
		modeSpecific = `
8. **General Mode Focus**: Use tools for document management (read_file, write_to_file, apply_diff, list_files, delete_file). Do not use code-specific search tools.

9. **Document Workflow**: For document tasks: (1) use list_files to browse files, (2) use read_file to examine content, (3) use write_to_file for new documents or apply_diff for targeted edits.

10. **Thoughtful Responses**: Provide well-structured, comprehensive responses. Adapt your tone to the context (formal for academic work, conversational for brainstorming). Use proper grammar and formatting.
`;
	} else {
		modeSpecific = `
8. **Agent Mode Focus**: Use tools to read, edit, and verify code while following the agreed plan. Prefer small, focused tool calls.

9. **Concise Implementation**: Prioritize code and minimal explanation. Do not create extra documents (design docs, reports, or long-form writeups) unless the user explicitly asks for them. Only be verbose when the user explicitly asks for more detail.

10. **Targeted Edit Workflow**: For any code change, follow this cycle: (1) use list_files / glob_search / grep_search / read_file to locate the exact code region, (2) reason about the current behavior and why it is wrong or incomplete, (3) decide the smallest, most local edit that satisfies the request, (4) apply it with apply_diff or write_to_file, and (5) re-run read_file or grep_search on the affected region to verify the change. Avoid touching unrelated files or code paths unless they are clearly required by the requested change.
`;
	}

	return `${sharedGuidelines}${modeSpecific}`;
}
