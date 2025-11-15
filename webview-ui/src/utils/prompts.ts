import type { WorkspaceContext } from '../types/workspace';

export interface PromptConfig {
  name: string;
  purpose: string;
  context: string;
}

function buildWorkspaceContext(workspace: WorkspaceContext | null): string {
  if (!workspace) {
    return 'No workspace is currently open.';
  }

  const fileList = workspace.files.length > 0
    ? `\n\nFiles in workspace:\n${workspace.files.join('\n')}`
    : '\n\nNo files found in workspace.';

  return `Workspace: ${workspace.name}\nDirectory: ${workspace.path}${fileList}`;
}

export function getPromptConfig(workspace: WorkspaceContext | null): PromptConfig {
  return {
    name: 'Echo',
    purpose: 'AI coding assistant for Visual Studio Code',
    context: buildWorkspaceContext(workspace)
  };
}

export function getSystemPrompt(workspace: WorkspaceContext | null): string {
  const config = getPromptConfig(workspace);
  return `${config.name}\n\n${config.context}`;
}