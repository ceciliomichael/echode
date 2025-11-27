import type { ChatMode } from '../../types/chat-mode';

export function getToolUseGuidelinesSection(mode: ChatMode): string {
	const isPlanMode = mode === 'plan';

	const sharedGuidelines = `====

TOOL USE GUIDELINES

1. **Assess Information Needs**: Before using any tool, determine what information you already have and what you need to proceed.

2. **Choose Appropriate Tools**: Use list_files for directories, grep_search for finding code, glob_search for paths, and read_file for file contents. For other tools, follow their <available_tools> descriptions.

3. **One Tool at a Time**: Execute tools iteratively, one per message. Each tool use must be informed by the result of the previous one. Do not assume outcomes.

4. **Wait for Results**: Always wait for tool results before continuing. Never assume success without explicit confirmation.

5. **Use Tool Results**: Treat tool outputs as ground truth for files, searches, diagnostics, and todos. Do not guess or invent file contents.

6. **NEVER Echo Tool Instructions**: Do not repeat or explain internal tool formats, XML syntax, or section headers like "Tool Format" to the user. Only use tools.

7. **Workspace Exploration Pipeline**: For any request involving the current project, first use glob_search or list_files to find candidate files, then grep_search to locate relevant code, then read_file on a small portion of the most relevant files (avoid reading many large files at once).
`;

	const modeSpecific = isPlanMode
		? `
8. **Plan Mode Focus**: Use tools only for exploration and planning (read_file, list_files, grep_search, glob_search, todo_write, plan_navigator, plan_handoff). Do not propose or perform code edits.

9. **Concise Planning**: Keep plans focused on files, steps, and success criteria. Avoid implementation details and long explanations.
`
		: `
8. **Agent Mode Focus**: Use tools to read, edit, and verify code while following the agreed plan. Prefer small, focused tool calls.

9. **Concise Implementation**: Prioritize code and minimal explanation. Only be verbose when the user explicitly asks for more detail.
`;

	return `${sharedGuidelines}${modeSpecific}`;
}
