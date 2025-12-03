import type { WorkspaceContext } from '../../types/workspace';
import type { ChatMode } from '../../types/chat-mode';

export function getCapabilitiesSection(workspace: WorkspaceContext | null, mode: ChatMode = 'agent'): string {
	const cwd = workspace?.path || 'the current workspace';

	const capabilityIntro = mode === 'general'
		? 'read and write files, apply targeted diffs, and manage documents. '
		: mode === 'agent'
			? 'read and write files, apply targeted diffs, and manage todo lists. '
			: mode === 'ask'
				? 'read files. '
				: 'read files, and manage todo lists. ';

	const taskExamples = mode === 'general'
		? 'writing documents, organizing files, '
		: mode === 'agent'
			? 'writing code, making edits or improvements to existing files, '
			: '';

	return `====

CAPABILITIES

- You have access to tools that let you list files, view source code, ${mode === 'general' ? '' : 'perform regex and glob searches, '}${capabilityIntro}These tools help you effectively accomplish a wide range of tasks, such as ${taskExamples}understanding the current state of a project, and much more.

- When the user initially gives you a task, a list of all files in the current workspace directory ('${cwd}') will be included in SYSTEM INFORMATION. This provides an overview of the project's file structure, offering key insights into the project from directory/file names (how developers conceptualize and organize their code) and file extensions (the language used). This can guide decision-making on which files to explore further.

- You can use **list_files** to explore directories. If you pass 'true' for the recursive parameter, it will list files recursively. Otherwise, it will list files at the top level, which is better suited for generic directories where you don't necessarily need the nested structure.

- You can use **grep_search** to perform regex searches across files in a specified directory, outputting context-rich results that include surrounding lines. This is particularly useful for understanding code patterns, finding specific implementations, or identifying areas that need refactoring.

- You can use **glob_search** to find files by name patterns, extensions, or fuzzy path matching. This is useful for discovering files when you know part of the filename or extension.

- You can use **read_file** to examine file contents with line numbers. You can optionally specify an offset and limit to read specific line ranges for large files.
${mode === 'agent' ? `
- For editing files, you have two primary tools:
  - **apply_diff**: For surgical, targeted edits to existing files. This is the PREFERRED method for all modifications to existing files. You MUST use read_file BEFORE apply_diff to get exact content for your SEARCH blocks.
  - **write_to_file**: For creating new files or completely rewriting existing files. When using this tool, you MUST provide the COMPLETE file content. Partial updates or placeholders like "// rest of code unchanged" are STRICTLY FORBIDDEN.
  
  Example workflow for editing:
  1. Use read_file to examine the current file contents
  2. Analyze the code and plan your changes
  3. Use apply_diff for targeted edits (preferred), or write_to_file for complete rewrites
  4. If you refactored code that could affect other parts of the codebase, use grep_search to ensure you update other files as needed.
` : mode === 'general' ? `
- For managing documents, you have these tools:
  - **apply_diff**: For making targeted edits to existing documents. Use read_file first to get exact content.
  - **write_to_file**: For creating new documents or completely rewriting existing ones. Always provide COMPLETE content.
  - **delete_file**: For removing files when explicitly requested.
  
  Example workflow for document editing:
  1. Use read_file to examine the current document contents
  2. Analyze the content and plan your changes
  3. Use apply_diff for targeted edits, or write_to_file for new documents
` : ''}
${mode === 'ask' || mode === 'general' ? '' : '- You can use **todo_write** and **todo_read** to manage a session-based task list. This helps track progress on multi-step tasks.'}`;
}
