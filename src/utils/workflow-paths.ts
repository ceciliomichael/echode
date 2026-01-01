import * as path from 'path';
import * as os from 'os';

/**
 * Workflow Path Utilities
 * 
 * Centralized path logic for workflow files stored in:
 * - Workspace: .echode/workflows/*.md
 * - Global: ~/.echode/workflows/*.md
 */

/**
 * Get the global workflows directory path (user home)
 */
export function getGlobalWorkflowsDir(): string {
  return path.join(os.homedir(), '.echode', 'workflows');
}

/**
 * Get the workspace workflows directory path
 */
export function getWorkspaceWorkflowsDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.echode', 'workflows');
}

/**
 * Get the full path to a specific workflow file
 * Returns the workspace path if workspaceRoot is provided, otherwise global
 */
export function getWorkflowFilePath(
  workflowName: string,
  workspaceRoot?: string
): string {
  const dir = workspaceRoot 
    ? getWorkspaceWorkflowsDir(workspaceRoot)
    : getGlobalWorkflowsDir();
  return path.join(dir, `${workflowName}.md`);
}