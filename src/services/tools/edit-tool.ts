import * as vscode from 'vscode';
import type { ITool, ToolExecutionResult, ChatMode, ToolConfirmation } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
import { FileLockManager } from './utils/file-lock-manager';
import { writeFileWithRetry } from './utils/write-file-with-retry';

function replaceOnce(original: string, oldString: string, newString: string): { replaced: boolean; content: string; occurrences: number } {
  const firstIndex = original.indexOf(oldString);
  if (firstIndex === -1) {
    return { replaced: false, content: original, occurrences: 0 };
  }

  const secondIndex = original.indexOf(oldString, firstIndex + oldString.length);
  if (secondIndex !== -1) {
    return { replaced: false, content: original, occurrences: 2 };
  }

  const content = original.slice(0, firstIndex) + newString + original.slice(firstIndex + oldString.length);
  return { replaced: true, content, occurrences: 1 };
}

function replaceAllOccurrences(original: string, oldString: string, newString: string): { replaced: boolean; content: string; occurrences: number } {
  if (!original.includes(oldString)) {
    return { replaced: false, content: original, occurrences: 0 };
  }

  const occurrences = original.split(oldString).length - 1;
  const content = original.split(oldString).join(newString);
  return { replaced: true, content, occurrences };
}

function normalizeToolNewlines(value: string): string {
  if (!value.includes('\r')) {
    return value;
  }
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '');
}

function toCrlf(value: string): string {
  return value.replace(/\n/g, '\r\n');
}

function countMatches(value: string, pattern: RegExp): number {
  const matches = value.match(pattern);
  return matches ? matches.length : 0;
}

function buildNotFoundHint(
  rawOldString: string,
  normalizedOldString: string,
  fileHasTabs: boolean,
  fileUsesCrlf: boolean,
): string {
  const rawCarriageReturns = countMatches(rawOldString, /\r/g);
  const normalizedTabs = countMatches(normalizedOldString, /\t/g);

  const hints: string[] = [];

  if (rawCarriageReturns > 0) {
    hints.push('Detected Windows-style carriage returns (\\r) in old_string; they were normalized.');
  }

  if (fileUsesCrlf && rawCarriageReturns === 0) {
    hints.push('The file appears to use CRLF (\\r\\n) line endings; old_string may have been provided with LF (\\n).');
  }

  if (fileHasTabs) {
    if (normalizedTabs === 0) {
      hints.push('The file contains tab characters. If indentation uses tabs, copying visible spaces instead of actual tab characters will not match.');
    } else {
      hints.push('old_string contains tab characters; ensure the file actually uses tabs at those positions.');
    }
  }

  return hints.join(' ');
}

function tryReplaceWithLineEndingFallback(
  originalContent: string,
  oldString: string,
  newString: string,
  replaceAll: boolean,
): { replaced: boolean; content: string; occurrences: number } {
  const primary = replaceAll
    ? replaceAllOccurrences(originalContent, oldString, newString)
    : replaceOnce(originalContent, oldString, newString);

  if (primary.replaced) {
    return primary;
  }

  // If the file is CRLF, retry with CRLF-converted strings.
  // This preserves exact-match semantics while handling Windows line endings.
  if (originalContent.includes('\r\n') && !oldString.includes('\r')) {
    const oldCrlf = toCrlf(oldString);
    const newCrlf = toCrlf(newString);
    return replaceAll
      ? replaceAllOccurrences(originalContent, oldCrlf, newCrlf)
      : replaceOnce(originalContent, oldCrlf, newCrlf);
  }

  return primary;
}

export class EditTool implements ITool {
  name = 'edit';

  async prepareExecution(
    parameters: Record<string, unknown>
  ): Promise<ToolConfirmation | undefined> {
    const filePath = parameters.file_path as string;
    const oldString = normalizeToolNewlines(parameters.old_string as string);
    const newString = normalizeToolNewlines(parameters.new_string as string);
    const explanation = parameters.explanation as string | undefined;
    const replaceAll = (parameters.replace_all as boolean | undefined) ?? false;

    if (!filePath || typeof oldString !== 'string' || typeof newString !== 'string') {
      return undefined;
    }

    if (oldString.length === 0) {
      return undefined;
    }

    if (newString === oldString) {
      return undefined;
    }

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      return undefined;
    }

    const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);

    try {
      const uri = vscode.Uri.file(absolutePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const originalContent = document.getText();

      const replacement = tryReplaceWithLineEndingFallback(originalContent, oldString, newString, replaceAll);

      if (!replacement.replaced) {
        return undefined;
      }

      return {
        toolName: this.name,
        title: `Edit: ${filePath}`,
        message: explanation ? `This will edit "${filePath}": ${explanation}` : `This will edit "${filePath}".`,
        diff: {
          oldContent: originalContent,
          newContent: replacement.content,
          fileName: filePath,
        },
        parameters,
      };
    } catch {
      return undefined;
    }
  }

  async execute(
    parameters: Record<string, unknown>,
    _onProgress?: unknown,
    _signal?: AbortSignal,
    _mode?: ChatMode
  ): Promise<ToolExecutionResult> {
    const filePath = parameters.file_path as string;
    const rawOldString = parameters.old_string as string;
    const rawNewString = parameters.new_string as string;
    const oldString = normalizeToolNewlines(rawOldString);
    const newString = normalizeToolNewlines(rawNewString);
    const explanation = parameters.explanation as string | undefined;
    const replaceAll = (parameters.replace_all as boolean | undefined) ?? false;

    if (!filePath) {
      return { success: false, error: 'file_path is required' };
    }

    if (typeof oldString !== 'string') {
      return { success: false, error: 'old_string must be a string' };
    }

    if (typeof newString !== 'string') {
      return { success: false, error: 'new_string must be a string' };
    }

    if (oldString.length === 0) {
      return { success: false, error: 'old_string must be non-empty' };
    }

    if (newString === oldString) {
      return { success: false, error: 'new_string must be different from old_string' };
    }

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      return { success: false, error: 'No workspace folder open' };
    }

    const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);

    console.log(`[EditTool] Resolved path file=${filePath} absolutePath=${absolutePath}`);

    let acquired = FileLockManager.tryAcquire(absolutePath);
    if (!acquired) {
      await FileLockManager.waitForLock(absolutePath);
      acquired = FileLockManager.tryAcquire(absolutePath);
    }

    if (!acquired) {
      return { success: false, error: `File is currently being modified: ${filePath}` };
    }

    try {
      const uri = vscode.Uri.file(absolutePath);

      let document: vscode.TextDocument;
      try {
        document = await vscode.workspace.openTextDocument(uri);
      } catch {
        return { success: false, error: `File does not exist or cannot be opened: ${absolutePath}` };
      }

      const originalContent = document.getText();
      const eol = originalContent.includes('\r\n') ? 'CRLF' : 'LF';
      const originalTail = originalContent.slice(Math.max(0, originalContent.length - 120));
      console.log(
        `[EditTool] Begin edit file=${filePath} eol=${eol} originalLen=${originalContent.length} oldLen=${oldString.length} newLen=${newString.length}`
      );
      console.log(`[EditTool] originalTail=${JSON.stringify(originalTail)}`);

      const replacement = tryReplaceWithLineEndingFallback(originalContent, oldString, newString, replaceAll);

      if (!replacement.replaced) {
        if (!replaceAll && replacement.occurrences >= 2) {
          return { success: false, error: 'old_string must be unique in the file unless replace_all is true' };
        }
        const fileHasTabs = originalContent.includes('\t');
        const fileUsesCrlf = originalContent.includes('\r\n');
        const hint = typeof rawOldString === 'string'
          ? buildNotFoundHint(rawOldString, oldString, fileHasTabs, fileUsesCrlf)
          : '';
        return {
          success: false,
          error: hint.length > 0
            ? `old_string was not found in the file. ${hint}`
            : 'old_string was not found in the file',
        };
      }

      const newContent = replacement.content;
      const newTail = newContent.slice(Math.max(0, newContent.length - 120));
      console.log(`[EditTool] newContentLen=${newContent.length} newTail=${JSON.stringify(newTail)}`);

      const writeResult = await writeFileWithRetry(uri, newContent, 3, 75);
      if (!writeResult.success) {
        return {
          success: false,
          error: writeResult.error ?? 'Failed to write file with integrity verification',
        };
      }

      const verifiedTail = (writeResult.finalContent ?? '').slice(Math.max(0, (writeResult.finalContent ?? '').length - 120));
      console.log(`[EditTool] Verified write attempts=${writeResult.attempts} len=${writeResult.finalContent?.length ?? 0} tail=${JSON.stringify(verifiedTail)}`);

      return {
        success: true,
        data: {
          message: `Successfully edited ${filePath}`,
          explanation,
          path: filePath,
          absolutePath,
          action: newContent === originalContent ? 'no_change' : 'modified',
          oldContent: originalContent,
          newContent,
          occurrences: replacement.occurrences,
          replaceAll,
          attempts: writeResult.attempts,
        },
      };
    } catch (error) {
      return { success: false, error: `Error editing file: ${error instanceof Error ? error.message : String(error)}` };
    } finally {
      FileLockManager.release(absolutePath);
    }
  }
}
