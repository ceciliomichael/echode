import * as vscode from 'vscode';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';

export class ListFilesTool implements ITool {
  name = 'list_files';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const dirPath = (parameters.path as string) || '';

    try {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        return { success: false, error: 'No workspace folder open' };
      }

      const absolutePath = dirPath ? resolveAbsolutePath(dirPath, workspaceRoot) : workspaceRoot;
      const uri = vscode.Uri.file(absolutePath);
      const entries = await vscode.workspace.fs.readDirectory(uri);

      const files: Array<{ name: string; type: string }> = [];
      const directories: Array<{ name: string; type: string }> = [];

      for (const [name, fileType] of entries) {
        // Skip hidden files/folders
        if (name.startsWith('.')) {
          continue;
        }

        if (fileType === vscode.FileType.Directory) {
          directories.push({ name, type: 'directory' });
        } else if (fileType === vscode.FileType.File) {
          files.push({ name, type: 'file' });
        }
      }

      // Sort alphabetically
      files.sort((a, b) => a.name.localeCompare(b.name));
      directories.sort((a, b) => a.name.localeCompare(b.name));

      return {
        success: true,
        data: {
          path: dirPath || '/',
          directories,
          files,
          totalCount: files.length + directories.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
