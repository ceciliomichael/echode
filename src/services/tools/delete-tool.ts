import * as vscode from 'vscode';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';

export class DeleteTool implements ITool {
  name = 'delete';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const rawFilePath = parameters.path as string;
    const filePath = rawFilePath?.trim();
    const rawType = parameters.type as string | undefined;
    const type = rawType?.trim();

    if (!filePath) {
      return { success: false, error: 'Path is required' };
    }

    if (!type) {
      return { success: false, error: 'Type is required (file or folder)' };
    }

    if (type !== 'file' && type !== 'folder') {
      return { success: false, error: "Type must be either 'file' or 'folder'" };
    }

    try {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        return { success: false, error: 'No workspace folder open' };
      }

      const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);
      const uri = vscode.Uri.file(absolutePath);

      // Capture file content before deletion for undo capability (only for files)
      let deletedContent: string | null = null;
      if (type === 'file') {
        try {
          const fileContent = await vscode.workspace.fs.readFile(uri);
          deletedContent = Buffer.from(fileContent).toString('utf8');
        } catch {
          return { success: false, error: `File not found: ${filePath}` };
        }
      } else {
        // For folders, check if it exists
        try {
          await vscode.workspace.fs.stat(uri);
        } catch {
          return { success: false, error: `Folder not found: ${filePath}` };
        }
      }

      // Delete file or folder
      await vscode.workspace.fs.delete(uri, { recursive: type === 'folder', useTrash: true });

      return {
        success: true,
        data: {
          path: filePath,
          type: type,
          action: 'deleted',
          deletedContent: deletedContent,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
