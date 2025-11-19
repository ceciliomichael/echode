import * as vscode from 'vscode';
import * as path from 'path';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';

export class WriteFileTool implements ITool {
  name = 'write_file';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const filePath = parameters.path as string;
    const content = parameters.content as string;

    if (!filePath) {
      return { success: false, error: 'File path is required' };
    }

    if (content === undefined) {
      return { success: false, error: 'Content is required' };
    }

    try {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        return { success: false, error: 'No workspace folder open' };
      }

      const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);
      const uri = vscode.Uri.file(absolutePath);
      
      // Check if file exists and capture old content
      let oldContent: string | null = null;
      let fileExisted = false;
      try {
        const oldFileContent = await vscode.workspace.fs.readFile(uri);
        oldContent = Buffer.from(oldFileContent).toString('utf8');
        fileExisted = true;
      } catch {
        // File doesn't exist, this is a new file
        fileExisted = false;
      }
      
      // Create parent directories if needed
      const dirPath = path.dirname(absolutePath);
      const dirUri = vscode.Uri.file(dirPath);
      try {
        await vscode.workspace.fs.createDirectory(dirUri);
      } catch {
        // Directory might already exist
      }

      // Write new content
      const contentBytes = Buffer.from(content, 'utf8');
      await vscode.workspace.fs.writeFile(uri, contentBytes);

      return {
        success: true,
        data: {
          path: filePath,
          action: fileExisted ? 'modified' : 'created',
          oldContent: oldContent,
          newContent: content,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
