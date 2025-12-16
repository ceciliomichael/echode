import * as vscode from 'vscode';
import * as path from 'path';
import type { ITool, ToolExecutionResult, ChatMode } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
import { addLineNumbers } from '../../utils/line-number-utils';

/**
 * Get mode-specific large file reminder
 * - Agent/General: Actionable refactor suggestion since these modes can edit
 * - Plan: Note to include refactoring in the implementation plan
 * - Ask: No reminder (just answering questions)
 */
function getLargeFileReminder(totalLines: number, mode?: ChatMode): string | undefined {
  if (totalLines <= 300) {
    return undefined;
  }

  switch (mode) {
    case 'ask':
      // Ask mode: no reminder needed, just answering questions
      return undefined;
    case 'plan':
      // Plan mode: include refactoring recommendation in the plan
      return `[LARGE FILE - ${totalLines} LINES] This file exceeds the 300-line threshold. Your implementation plan SHOULD include a task to refactor this file into smaller, focused modules following single responsibility principle and logical grouping by feature/concern.`;
    case 'agent':
    case 'general':
    default:
      // Agent/General modes: can edit, so give actionable refactor advice
      return `[LARGE FILE - ${totalLines} LINES] This file exceeds the 300-line threshold. Before making extensive changes, consider refactoring into smaller, focused modules. Split by logical boundaries (features, concerns, or responsibilities) to maintain code quality.`;
  }
}

export class ReadFileTool implements ITool {
  name = 'read_file';

  private formatWithLineNumbers(lines: string[], startLine: number): string {
    return lines
      .map((line, index) => `${startLine + index} | ${line}`)
      .join('\n');
  }

  async execute(
    parameters: Record<string, unknown>,
    _onProgress?: unknown,
    _signal?: AbortSignal,
    mode?: ChatMode
  ): Promise<ToolExecutionResult> {
    const offset = parameters.offset as number | undefined;
    const limit = parameters.limit as number | undefined;
    const filePath = parameters.path as string | undefined;

    if (!filePath) {
      return { success: false, error: 'File path is required. Use "path" parameter with a file path.' };
    }

    return this.readSingleFile(filePath, offset, limit, mode);
  }

  private async readSingleFile(
    filePath: string,
    offset: number | undefined,
    limit: number | undefined,
    mode?: ChatMode
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

      // Check if file is already open in an editor - use that content for freshest state
      const openDocument = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
      let content: string;

      if (openDocument) {
        content = openDocument.getText();
      } else {
        const fileContent = await vscode.workspace.fs.readFile(uri);
        content = Buffer.from(fileContent).toString('utf8');
      }

      const lines = content.split(/\r?\n/);
      const totalLines = lines.length;

      // Apply default 500-line limit when no range specified
      if (offset === undefined && limit === undefined) {
        const defaultStart = 0;
        const defaultCount = Math.min(500, lines.length);
        const defaultEnd = Math.min(defaultStart + defaultCount, lines.length);
        const selectedLines = lines.slice(defaultStart, defaultEnd);
        const numberedContent = addLineNumbers(selectedLines.join('\n'), defaultStart + 1);

        // Add mode-specific reminder for large files
        const refactorReminder = getLargeFileReminder(totalLines, mode);
        const refactorNotice = refactorReminder
          ? {
            type: 'large_file',
            lineCount: totalLines,
            mode,
            message: refactorReminder,
          }
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
            refactorNotice,
          },
        };
      }

      // Apply explicit offset/limit if specified
      const start = offset ? Math.max(0, offset - 1) : 0;
      const count = limit || lines.length;
      const end = Math.min(start + count, lines.length);
      const selectedLines = lines.slice(start, end);
      const numberedContent = addLineNumbers(selectedLines.join('\n'), start + 1);

      // Add mode-specific reminder for large files
      const refactorReminder = getLargeFileReminder(totalLines, mode);
      const refactorNotice = refactorReminder
        ? {
          type: 'large_file',
          lineCount: totalLines,
          mode,
          message: refactorReminder,
        }
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
          refactorNotice,
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

