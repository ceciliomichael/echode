import * as vscode from 'vscode';
import * as path from 'path';
import type { ITool, ToolExecutionResult, ChatMode } from './tool.interface';
import { PathResolver } from '../path-resolver';
// import { addLineNumbers } from '../../utils/line-number-utils';
import { isBinaryFile } from '../../constants/excluded-patterns';
import { normalizeToLf } from './utils/newline-utils';

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

  // private formatWithLineNumbers(lines: string[], startLine: number): string {
  //   return lines
  //     .map((line, index) => `${startLine + index} | ${line}`)
  //     .join('\n');
  // }

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

  private processContent(
    filePath: string,
    absolutePath: string,
    content: string,
    offset: number | undefined,
    limit: number | undefined,
    mode?: ChatMode
  ): ToolExecutionResult {
    const normalizedContent = normalizeToLf(content);
    const lines = normalizedContent.split('\n');
    const totalLines = lines.length;

    // Default range values
    let start = 0;
    let end = lines.length;

    if (offset === undefined && limit === undefined) {
      // Default: First 500 lines
      start = 0;
      const count = Math.min(500, lines.length);
      end = Math.min(start + count, lines.length);
    } else {
      // Explicit range
      start = offset ? Math.max(0, offset - 1) : 0;
      const count = limit || lines.length;
      end = Math.min(start + count, lines.length);
    }

    const selectedLines = lines.slice(start, end);
    const contentWithoutLineNumbers = selectedLines.join('\n');

    // Add mode-specific reminder for large files
    const refactorReminder = getLargeFileReminder(totalLines, mode);
    const refactorNotice = refactorReminder
      ? {
        type: 'large_file' as const,
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
        content: contentWithoutLineNumbers,
        startLine: start + 1,
        endLine: end,
        totalLines,
        refactorReminder,
        refactorNotice,
      },
    };
  }

  private async readSingleFile(
    filePath: string,
    offset: number | undefined,
    limit: number | undefined,
    mode?: ChatMode
  ): Promise<ToolExecutionResult> {

    try {
      let resolvedPath;
      try {
        resolvedPath = PathResolver.resolve(filePath);
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to resolve path' };
      }

      const { uri, absolutePath } = resolvedPath;

      // 1. Optimization: Check if file is already open in an editor
      // This bypasses filesystem checks for open files and ensures we get the freshest in-memory content
      // It also avoids false "directory" errors if the path is open as a document
      const openDocument = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
      
      if (openDocument) {
        return this.processContent(filePath, absolutePath, openDocument.getText(), offset, limit, mode);
      }

      // 2. Check if file is binary
      if (isBinaryFile(absolutePath)) {
        return {
          success: false,
          error: `Cannot read binary file '${filePath}'. Binary files (like .jar, .exe, .zip, images, etc.) are not readable as text.`,
        };
      }

      // 3. Ensure the file exists via filesystem
      let stat: vscode.FileStat;
      try {
        stat = await vscode.workspace.fs.stat(uri);
      } catch (_error) {
        return {
          success: false,
          error: `Cannot read '${filePath}' because it does not exist (it may have been deleted or reverted).`,
        };
      }

      // 4. Check if path is a directory
      if (stat.type === vscode.FileType.Directory) {
        return {
          success: false,
          error: `Cannot read directory '${filePath}'. Please use 'list_files' to view directory contents, then call 'read_file' on a specific file from that listing (e.g., ${filePath}/file.tsx).`,
        };
      }

      // 5. Read from filesystem
      const fileContent = await vscode.workspace.fs.readFile(uri);
      const content = Buffer.from(fileContent).toString('utf8');
      
      return this.processContent(filePath, absolutePath, content, offset, limit, mode);

    } catch (error) {
      return {
        success: false,
        error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

}

