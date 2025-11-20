import * as vscode from 'vscode';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';

export class ReadFileTool implements ITool {
  name = 'read_file';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    // Check if this is a batch request
    if (parameters.files && Array.isArray(parameters.files)) {
      return this.executeBatch(parameters.files as Array<{ path: string; line_range?: { start?: number; end?: number } }>);
    }

    // Single file request (backward compatible)
    const filePath = parameters.path as string;
    const startLine = parameters.startLine as number | undefined;
    const endLine = parameters.endLine as number | undefined;

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

      // If line range is specified, extract those lines
      if (startLine !== undefined || endLine !== undefined) {
        const lines = content.split('\n');
        const start = startLine ? Math.max(0, startLine - 1) : 0;
        const end = endLine ? Math.min(lines.length, endLine) : lines.length;
        const selectedLines = lines.slice(start, end);
        
        // Return raw content without line numbers
        const formattedContent = selectedLines.join('\n');

        return {
          success: true,
          data: {
            path: filePath,
            content: formattedContent,
            startLine: start + 1,
            endLine: end,
            totalLines: lines.length,
          },
        };
      }

      // Return full raw content
      return {
        success: true,
        data: {
          path: filePath,
          content: content,
          totalLines: content.split('\n').length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async executeBatch(
    files: Array<{ path: string; line_range?: { start?: number; end?: number } }>
  ): Promise<ToolExecutionResult> {
    if (!files || files.length === 0) {
      return { success: false, error: 'No files specified in batch request' };
    }

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      return { success: false, error: 'No workspace folder open' };
    }

    const results = [];

    for (const fileRequest of files) {
      const { path: filePath, line_range } = fileRequest;
      
      if (!filePath) {
        results.push({
          success: false,
          path: '',
          error: 'File path is required',
        });
        continue;
      }

      try {
        const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);
        const uri = vscode.Uri.file(absolutePath);

        // Check if path is a directory
        try {
          const stat = await vscode.workspace.fs.stat(uri);
          if (stat.type === vscode.FileType.Directory) {
            results.push({
              success: false,
              path: filePath,
              error: `Cannot read directory '${filePath}'. Please use 'list_files' to view directory contents.`,
            });
            continue;
          }
        } catch (error) {
          // If stat fails, readFile will handle the error
        }

        const fileContent = await vscode.workspace.fs.readFile(uri);
        const content = Buffer.from(fileContent).toString('utf8');

        // Handle line range if specified
        if (line_range && (line_range.start !== undefined || line_range.end !== undefined)) {
          const lines = content.split('\n');
          const start = line_range.start ? Math.max(0, line_range.start - 1) : 0;
          const end = line_range.end ? Math.min(lines.length, line_range.end) : lines.length;
          const selectedLines = lines.slice(start, end);
          const formattedContent = selectedLines.join('\n');

          results.push({
            success: true,
            path: filePath,
            content: formattedContent,
            startLine: start + 1,
            endLine: end,
            totalLines: lines.length,
          });
        } else {
          // Return full content
          results.push({
            success: true,
            path: filePath,
            content: content,
            totalLines: content.split('\n').length,
          });
        }
      } catch (error) {
        results.push({
          success: false,
          path: filePath,
          error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    // Return batch results
    return {
      success: true,
      data: {
        batch: true,
        files: results,
      },
    };
  }
}
