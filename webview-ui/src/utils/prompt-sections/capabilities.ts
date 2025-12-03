import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';

export function getCapabilitiesSection(workspace: WorkspaceContext | null, enabledTools: Tool[] = []): string {
	const cwd = workspace?.path || 'the current workspace';
	const enabledIds = new Set(enabledTools.map(t => t.id));

	// Tool descriptions - only enabled ones will be shown
	const TOOL_CAPS: Record<string, string> = {
		list_files: 'explore directories',
		read_file: 'view file contents',
		grep_search: 'search within files',
		glob_search: 'find files by pattern',
		write_to_file: 'create/rewrite files',
		apply_diff: 'make targeted edits',
		delete_file: 'delete files',
		todo_write: 'manage task lists',
	};

	const capabilities = enabledTools
		.filter(t => TOOL_CAPS[t.id])
		.map(t => TOOL_CAPS[t.id]);

	const capabilityIntro = capabilities.length > 0 ? capabilities.join(', ') : 'assist with tasks';

	return `====

CAPABILITIES

- You have access to tools that let you ${capabilityIntro}. These tools help you accomplish tasks like understanding the current state of a project and much more.

- When the user gives you a task, a list of all files in the workspace ('${cwd}') will be included in SYSTEM INFORMATION. This provides an overview of the project's file structure.

${enabledIds.has('read_file') ? '- Use **read_file** to examine file contents with line numbers.\n' : ''}${enabledIds.has('list_files') ? '- Use **list_files** to explore directories.\n' : ''}${enabledIds.has('grep_search') ? '- Use **grep_search** to search within files using regex patterns.\n' : ''}${enabledIds.has('glob_search') ? '- Use **glob_search** to find files by name patterns.\n' : ''}${enabledIds.has('apply_diff') ? '- Use **apply_diff** for targeted edits to existing files (preferred).\n' : ''}${enabledIds.has('write_to_file') ? '- Use **write_to_file** for new files or complete rewrites.\n' : ''}${enabledIds.has('delete_file') ? '- Use **delete_file** to remove files when explicitly requested.\n' : ''}${enabledIds.has('todo_write') ? '- Use **todo_write** and **todo_read** to manage task lists.\n' : ''}`;
}
