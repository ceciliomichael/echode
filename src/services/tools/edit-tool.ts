import * as vscode from 'vscode';
import type { ITool, ToolExecutionResult, ChatMode, ToolConfirmation } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
import { FileLockManager } from './utils/file-lock-manager';
import { writeFileWithRetry } from './utils/write-file-with-retry';
import { openFileInBackground } from './utils/editor-utils';
import { normalizeToLf } from './utils/newline-utils';

/**
 * Build a mapping from normalized (LF) string positions back to original string positions.
 * For every index in the normalized string, maps[i] = corresponding index in the original.
 * This lets us find a match in LF-normalized space and splice the original content directly.
 */
function buildIndexMap(original: string): number[] {
  const map: number[] = [];
  let oi = 0;
  while (oi < original.length) {
    if (original[oi] === '\r' && oi + 1 < original.length && original[oi + 1] === '\n') {
      // CRLF: map this normalized position to the \r position, skip \r
      map.push(oi);
      oi += 2; // skip \r\n, mapped as single \n
    } else {
      map.push(oi);
      oi += 1;
    }
  }
  // Sentinel: map the end-of-normalized-string to end-of-original
  map.push(original.length);
  return map;
}

/**
 * Find all occurrences of `needle` in `haystack`, returning start indices.
 */
function findAllIndices(haystack: string, needle: string): number[] {
  const indices: number[] = [];
  let pos = 0;
  while (pos <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, pos);
    if (idx === -1) { break; }
    indices.push(idx);
    pos = idx + needle.length;
  }
  return indices;
}

interface ReplaceResult {
  replaced: boolean;
  content: string;
  occurrences: number;
}

/**
 * Core replacement logic. Works by:
 * 1. Normalizing both file content and old_string to LF for matching
 * 2. Finding match positions in normalized space
 * 3. Mapping those positions back to the original content
 * 4. Splicing the original content directly, preserving all original line endings outside the edit
 * 5. new_string uses the file's detected EOL style
 */
function replaceInOriginal(
  originalContent: string,
  oldString: string,
  newString: string,
  replaceAll: boolean,
): ReplaceResult {
  const normalizedContent = normalizeToLf(originalContent);
  const normalizedOld = normalizeToLf(oldString);
  const normalizedNew = normalizeToLf(newString);

  const matches = findAllIndices(normalizedContent, normalizedOld);

  if (matches.length === 0) {
    return { replaced: false, content: originalContent, occurrences: 0 };
  }

  if (!replaceAll && matches.length > 1) {
    return { replaced: false, content: originalContent, occurrences: matches.length };
  }

  // Detect file's line ending to apply to new_string
  const usesCrlf = originalContent.includes('\r\n');
  const finalNew = usesCrlf ? normalizedNew.replace(/\n/g, '\r\n') : normalizedNew;

  // Build index map from normalized positions → original positions
  const indexMap = buildIndexMap(originalContent);

  // Apply replacements from end to start so indices stay valid
  const toReplace = replaceAll ? matches : [matches[0]];
  let result = originalContent;

  for (let i = toReplace.length - 1; i >= 0; i--) {
    const normStart = toReplace[i];
    const normEnd = normStart + normalizedOld.length;
    const origStart = indexMap[normStart];
    const origEnd = indexMap[normEnd];
    result = result.slice(0, origStart) + finalNew + result.slice(origEnd);
  }

  return { replaced: true, content: result, occurrences: toReplace.length };
}

export class EditTool implements ITool {
  name = 'edit';

  async prepareExecution(
    parameters: Record<string, unknown>
  ): Promise<ToolConfirmation | undefined> {
    const rawFilePath = parameters.file_path as string;
    const filePath = rawFilePath?.trim();
    const oldString = parameters.old_string as string;
    const newString = parameters.new_string as string;
    const explanation = parameters.explanation as string | undefined;
    const replaceAll = (parameters.replace_all as boolean | undefined) ?? false;

    if (!filePath || typeof oldString !== 'string' || typeof newString !== 'string') {
      return undefined;
    }

    if (normalizeToLf(oldString).length === 0) {
      return undefined;
    }

    if (normalizeToLf(newString) === normalizeToLf(oldString)) {
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

      const replacement = replaceInOriginal(originalContent, oldString, newString, replaceAll);

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
    const rawFilePath = parameters.file_path as string;
    const filePath = rawFilePath?.trim();
    const oldString = parameters.old_string as string;
    const newString = parameters.new_string as string;
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

    const normalizedOld = normalizeToLf(oldString);
    const normalizedNew = normalizeToLf(newString);

    if (normalizedOld.length === 0) {
      return { success: false, error: 'old_string must be non-empty' };
    }

    if (normalizedNew === normalizedOld) {
      return { success: false, error: 'new_string must be different from old_string' };
    }

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      return { success: false, error: 'No workspace folder open' };
    }

    const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);

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

      const replacement = replaceInOriginal(originalContent, oldString, newString, replaceAll);

      if (!replacement.replaced) {
        if (!replaceAll && replacement.occurrences >= 2) {
          return { success: false, error: 'old_string must be unique in the file unless replace_all is true' };
        }
        return { success: false, error: 'old_string was not found in the file' };
      }

      const newContent = replacement.content;

      const writeResult = await writeFileWithRetry(uri, newContent, 3, 75);
      if (!writeResult.success) {
        return {
          success: false,
          error: writeResult.error ?? 'Failed to write file with integrity verification',
        };
      }

      // Open the edited file in the editor
      await openFileInBackground(uri);

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
