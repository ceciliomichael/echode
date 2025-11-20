import * as vscode from 'vscode';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';

export class ReadFileTool implements ITool {
  name = 'read_file';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const filePath = parameters.path as string;
    const offset = parameters.offset as number | undefined;
    const limit = parameters.limit as number | undefined;

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

      // Check if path is a directory
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type === vscode.FileType.Directory) {
          return {
            success: false,
            error: `Cannot read directory '${filePath}'. Please use 'list_files' to view directory contents.`,
          };
        }
      } catch (error) {
        // If stat fails (e.g. file not found), readFile will handle the error appropriate
      }

      const fileContent = await vscode.workspace.fs.readFile(uri);
      const content = Buffer.from(fileContent).toString('utf8');
      const lines = content.split('\n');
      const totalLines = lines.length;

      // Handle large files (>1000 lines) - warn if no range specified
      if (totalLines > 1000 && offset === undefined && limit === undefined) {
        return {
          success: false,
          error: `File has ${totalLines} lines. Please specify offset and limit parameters to read a portion of the file. Example: offset=1, limit=100 to read first 100 lines.`,
        };
      }

      // Apply offset/limit if specified
      if (offset !== undefined || limit !== undefined) {
        const start = offset ? Math.max(0, offset - 1) : 0;
        const count = limit || lines.length;
        const end = Math.min(start + count, lines.length);
        const selectedLines = lines.slice(start, end);
        const formattedContent = selectedLines.join('\n');

        return {
          success: true,
          data: {
            path: filePath,
            content: formattedContent,
            startLine: start + 1,
            endLine: end,
            totalLines,
          },
        };
      }

      // Return full content for small files (with line numbers for transparency)
      return {
        success: true,
        data: {
          path: filePath,
          content,
          startLine: 1,
          endLine: totalLines,
          totalLines,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

}
