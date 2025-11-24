import type { WorkspaceContext } from '../../types/workspace';

export function getSystemInfoSection(workspace: WorkspaceContext | null): string {
	if (!workspace) {
		return `====

SYSTEM INFORMATION

No workspace is currently open.`;
	}

	const fileList = workspace.files.length > 0
		? `\n\nFiles currently in workspace:\n${workspace.files.join('\n')}`
		: '\n\nNo files found in workspace.';

	return `====

SYSTEM INFORMATION

Operating System: Windows
Current Workspace: ${workspace.name}
Workspace Directory: ${workspace.path}${fileList}

The Workspace Directory is the active VS Code project directory, and is the default directory for all file operations. When the user initially gives you a task, the list of files in the current workspace directory will be included above. This provides an overview of the project's file structure, offering key insights into the project from directory/file names (how developers conceptualize and organize their code) and file extensions (the language used).

IMPORTANT: The file list above is the COMPLETE snapshot of files in the workspace. Do NOT attempt to read, reference, or assume the existence of ANY files not listed above. If you need to check if a file exists, use list_files or glob_search first. Never use read_file on files not shown in the workspace snapshot.`;
}
