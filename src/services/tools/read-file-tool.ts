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

    // Extract paths - support both 'path' (single) and 'paths' (array) parameters
    const paths: string[] = [];
    const singlePath = parameters.path as string | undefined;
    const multiplePaths = parameters.paths as string[] | undefined;

    // Single path parameter
    if (singlePath) {
      paths.push(singlePath);
    }

    // Multiple paths array parameter
    if (multiplePaths && Array.isArray(multiplePaths)) {
      paths.push(...multiplePaths);
    }

    if (paths.length === 0) {
      return { success: false, error: 'File path is required. Use "path" for single file or "paths" array for multiple files.' };
    }

    // Single file - use direct return
    if (paths.length === 1) {
      return this.readSingleFile(paths[0], offset, limit);
    }

    // Multiple files - read in parallel
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

        // Add refactor reminder for large files
        const refactorReminder = totalLines > 300
          ? `⚠️ **REFACTOR REQUIRED**: This file has ${totalLines} lines (exceeds 300-line threshold). Before continuing implementation, you MUST first refactor this file into smaller, focused modules. Large files violate clean code principles. Stop current work, split this file logically, then resume.`
          : undefined;

        return {
          success: true,
          data: {
            path: filePath,
            absolutePath,
            content: numberedContent.trimEnd(), // Remove trailing newline added by addLineNumbers
            startLine: defaultStart + 1,
            endLine: defaultEnd,
            totalLines,
            refactorReminder,
          },
        };
      }

      // Apply explicit offset/limit if specified
      const start = offset ? Math.max(0, offset - 1) : 0;
      const count = limit || lines.length;
      const end = Math.min(start + count, lines.length);
      const selectedLines = lines.slice(start, end);
      const numberedContent = addLineNumbers(selectedLines.join('\n'), start + 1);

      // Add refactor reminder for large files
      const refactorReminder = totalLines > 300
        ? `⚠️ **REFACTOR REQUIRED**: This file has ${totalLines} lines (exceeds 300-line threshold). Before continuing implementation, you MUST first refactor this file into smaller, focused modules. Large files violate clean code principles. Stop current work, split this file logically, then resume.`
        : undefined;

      return {
        success: true,
        data: {
          path: filePath,
          absolutePath,
          content: numberedContent.trimEnd(), // Remove trailing newline added by addLineNumbers
          startLine: start + 1,
          endLine: end,
          totalLines,
          refactorReminder,
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
