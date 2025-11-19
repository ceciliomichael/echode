import * as vscode from 'vscode';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';

export class DeleteFileTool implements ITool {
  name = 'delete_file';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const filePath = parameters.path as string;

    if (!filePath) {
      return { success: false, error: 'File path is required' };
    }

    try {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        return { success: false, error: 'No workspace folder open' };
      }

      const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);
      const uri = vscode.Uri.file(absolutePath);

      // Check if file exists
      try {
        await vscode.workspace.fs.stat(uri);
      } catch {
        return { success: false, error: `File not found: ${filePath}` };
      }

      // Delete file
      await vscode.workspace.fs.delete(uri, { recursive: false, useTrash: true });

      return {
        success: true,
        data: {
          path: filePath,
          action: 'deleted',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
