import * as vscode from 'vscode';
import * as path from 'path';
import type { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
import { addLineNumbers } from '../../utils/line-number-utils';

export class ReadFileTool implements ITool {
  name = 'read_file';

  private formatWithLineNumbers(lines: string[], startLine: number): string {
    return lines
      .map((line, index) => `${startLine + index} | ${line}`)
      .join('\n');
  }

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const offset = parameters.offset as number | undefined;
    const limit = parameters.limit as number | undefined;

    // Extract all path parameters (path1-path5, with fallback to legacy 'path')
    const paths: string[] = [];
    const legacyPath = parameters.path as string | undefined;
    const path1 = parameters.path1 as string | undefined;
    const path2 = parameters.path2 as string | undefined;
    const path3 = parameters.path3 as string | undefined;
    const path4 = parameters.path4 as string | undefined;
    const path5 = parameters.path5 as string | undefined;

    // Support legacy 'path' parameter for backwards compatibility
    if (legacyPath) {
      paths.push(legacyPath);
    }
    
    // Add path1-path5 if provided
    if (path1) {
      paths.push(path1);
    }
    if (path2) {
      paths.push(path2);
    }
    if (path3) {
      paths.push(path3);
    }
    if (path4) {
      paths.push(path4);
    }
    if (path5) {
      paths.push(path5);
    }

    if (paths.length === 0) {
      return { success: false, error: 'At least one file path is required (path1 or legacy path parameter)' };
    }

    // If only one file, use the original single-file logic
    if (paths.length === 1) {
      return this.readSingleFile(paths[0], offset, limit);
    }

    // Multiple files: read them all in parallel
    return this.readMultipleFiles(paths, offset, limit);
  }

  private async readSingleFile(
    filePath: string,
    offset: number | undefined,
    limit: number | undefined
  ): Promise<ToolExecutionResult> {

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
            error: `Cannot read directory '${filePath}'. Please use 'list_files' to view directory contents, then call 'read_file' on a specific file from that listing (e.g., ${filePath}/file.tsx).`,
          };
        }
      } catch (error) {
        // If stat fails (e.g. file not found), readFile will handle the error appropriate
      }

      const fileContent = await vscode.workspace.fs.readFile(uri);
      const content = Buffer.from(fileContent).toString('utf8');
      const lines = content.split(/\r?\n/);
      const totalLines = lines.length;

      // Apply default 500-line limit when no range specified
      if (offset === undefined && limit === undefined) {
        const defaultStart = 0;
        const defaultCount = Math.min(500, lines.length);
        const defaultEnd = Math.min(defaultStart + defaultCount, lines.length);
        const selectedLines = lines.slice(defaultStart, defaultEnd);
        const numberedContent = addLineNumbers(selectedLines.join('\n'), defaultStart + 1);

        return {
          success: true,
          data: {
            path: filePath,
            absolutePath,
            content: numberedContent.trimEnd(), // Remove trailing newline added by addLineNumbers
            startLine: defaultStart + 1,
            endLine: defaultEnd,
            totalLines,
          },
        };
      }

      // Apply explicit offset/limit if specified
      const start = offset ? Math.max(0, offset - 1) : 0;
      const count = limit || lines.length;
      const end = Math.min(start + count, lines.length);
      const selectedLines = lines.slice(start, end);
      const numberedContent = addLineNumbers(selectedLines.join('\n'), start + 1);

      return {
        success: true,
        data: {
          path: filePath,
          absolutePath,
          content: numberedContent.trimEnd(), // Remove trailing newline added by addLineNumbers
          startLine: start + 1,
          endLine: end,
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

  private async readMultipleFiles(
    filePaths: string[],
    offset: number | undefined,
    limit: number | undefined
  ): Promise<ToolExecutionResult> {
    try {
      // Read all files in parallel
      const results = await Promise.all(
        filePaths.map(filePath => this.readSingleFile(filePath, offset, limit))
      );

      // Check if any failed
      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        // If any file failed, return the first error
        return failures[0];
      }

      // Combine all successful results
      const combinedData = results.map(r => r.data);
      
      return {
        success: true,
        data: {
          files: combinedData,
          count: combinedData.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read multiple files: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

}
