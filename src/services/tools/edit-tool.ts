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

 function indexToLineNumber(text: string, index: number): number {
  // 1-based line number
  if (index <= 0) {
    return 1;
  }
  let lines = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === '\n') {
      lines++;
    }
  }
  return lines;
 }

 function getLineSnippet(
  normalizedContent: string,
  centerIndex: number,
  linesBefore: number,
  linesAfter: number,
 ): { startLine: number; endLine: number; snippet: string } {
  const allLines = normalizedContent.split('\n');
  const centerLine = Math.max(1, indexToLineNumber(normalizedContent, centerIndex));
  const startLine = Math.max(1, centerLine - linesBefore);
  const endLine = Math.min(allLines.length, centerLine + linesAfter);

  const selected = allLines.slice(startLine - 1, endLine);
  const snippet = selected
    .map((line, i) => `${startLine + i} | ${line}`)
    .join('\n');

  return { startLine, endLine, snippet };
 }

 function getAnchorLines(oldString: string, maxAnchors = 3): string[] {
  const normalizedOld = normalizeToLf(oldString);
  const lines = normalizedOld
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // Prefer longer anchors first
  lines.sort((a, b) => b.length - a.length);
  return lines.slice(0, maxAnchors);
 }

 function findFirstAnchorContext(
  normalizedContent: string,
  oldString: string,
 ): { anchor: string; startLine: number; endLine: number; snippet: string } | undefined {
  const anchors = getAnchorLines(oldString);
  for (const anchor of anchors) {
    const idx = normalizedContent.indexOf(anchor);
    if (idx !== -1) {
      const snippet = getLineSnippet(normalizedContent, idx, 3, 3);
      return { anchor, ...snippet };
    }
  }
  return undefined;
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
    // === INDENTATION-FLEXIBLE FALLBACK ===
    // The AI often sends old_string with wrong indentation (off by 1+ tabs/spaces).
    // Try matching with leading whitespace stripped from each line, then apply
    // new_string with the file's actual indentation.
    const flexResult = tryIndentFlexibleReplace(
      originalContent, normalizedContent, normalizedOld, normalizedNew, replaceAll
    );
    if (flexResult) {
      return flexResult;
    }
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

/**
 * Get the leading whitespace of a line
 */
function getLeadingWhitespace(line: string): string {
  const match = line.match(/^(\s*)/);
  return match ? match[1] : '';
}

/**
 * Strip leading whitespace from each line, returning stripped lines
 */
function stripLeadingWhitespace(text: string): string {
  return text.split('\n').map(l => l.trimStart()).join('\n');
}

/**
 * Indentation-flexible fallback for when old_string has wrong indentation.
 * Strips leading whitespace from both old_string and file content lines,
 * finds the match, detects the indentation offset, and applies new_string
 * with the file's actual indentation.
 */
function tryIndentFlexibleReplace(
  originalContent: string,
  normalizedContent: string,
  normalizedOld: string,
  normalizedNew: string,
  replaceAll: boolean,
): ReplaceResult | null {
  const strippedOld = stripLeadingWhitespace(normalizedOld);
  const strippedContent = stripLeadingWhitespace(normalizedContent);

  // Don't do flexible match on single-line or very short strings
  if (!strippedOld.includes('\n') || strippedOld.length < 20) {
    return null;
  }

  const strippedMatches = findAllIndices(strippedContent, strippedOld);

  if (strippedMatches.length === 0) {
    return null;
  }

  if (!replaceAll && strippedMatches.length > 1) {
    // Still ambiguous even with flexible matching
    return null;
  }

  // Map stripped match position back to the normalized content position.
  // We do this by counting newlines: the stripped match starts at a certain
  // line in strippedContent, and we find the same line in normalizedContent.
  const strippedMatchStart = replaceAll ? strippedMatches[0] : strippedMatches[0];
  const linesBefore = strippedContent.slice(0, strippedMatchStart).split('\n').length - 1;

  // Find the start of that line in normalizedContent
  const contentLines = normalizedContent.split('\n');
  let normMatchStart = 0;
  for (let i = 0; i < linesBefore; i++) {
    normMatchStart += contentLines[i].length + 1; // +1 for \n
  }

  // Count how many lines old_string spans
  const oldLines = normalizedOld.split('\n');
  const matchedFileLines = contentLines.slice(linesBefore, linesBefore + oldLines.length);

  // Verify the stripped content actually matches line by line
  for (let i = 0; i < oldLines.length; i++) {
    if (i >= matchedFileLines.length) { return null; }
    if (oldLines[i].trimStart() !== matchedFileLines[i].trimStart()) {
      return null; // Content doesn't actually match when stripped
    }
  }

  // Detect the indentation offset between AI's old_string and the file
  // Use the first non-empty line to determine the offset
  let indentOffset = '';
  for (let i = 0; i < oldLines.length; i++) {
    const oldIndent = getLeadingWhitespace(oldLines[i]);
    const fileIndent = getLeadingWhitespace(matchedFileLines[i]);
    if (oldLines[i].trim().length > 0 && matchedFileLines[i].trim().length > 0) {
      // The file has more indentation than old_string by this much
      if (fileIndent.startsWith(oldIndent)) {
        indentOffset = fileIndent.slice(oldIndent.length);
      } else if (oldIndent.startsWith(fileIndent)) {
        // AI added extra indentation — we'd need to remove, but that's riskier
        // Only handle the common case: file has MORE indent than AI sent
        indentOffset = '';
      }
      break;
    }
  }

  // Apply the same indentation offset to new_string
  const newLines = normalizedNew.split('\n');
  const adjustedNewLines = newLines.map(line => {
    if (line.trim().length === 0) { return line; } // preserve empty lines
    return indentOffset + line;
  });
  const adjustedNew = adjustedNewLines.join('\n');

  // Now do the actual replacement using the file's real content
  const usesCrlf = originalContent.includes('\r\n');
  const finalNew = usesCrlf ? adjustedNew.replace(/\n/g, '\r\n') : adjustedNew;

  // Calculate the exact range in normalizedContent to replace
  let normMatchEnd = normMatchStart;
  for (let i = 0; i < oldLines.length; i++) {
    normMatchEnd += matchedFileLines[i].length;
    if (i < oldLines.length - 1) { normMatchEnd += 1; } // +1 for \n
  }

  const indexMap = buildIndexMap(originalContent);
  const origStart = indexMap[normMatchStart];
  const origEnd = indexMap[normMatchEnd];
  const result = originalContent.slice(0, origStart) + finalNew + originalContent.slice(origEnd);

  return { replaced: true, content: result, occurrences: 1 };
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

      // === PRE-EDIT DEBUG ===
      {
        const dbg = vscode.window.createOutputChannel('EchoDE Edit Debug', { log: true });
        const nOld = normalizeToLf(oldString);
        const nFile = normalizeToLf(originalContent);
        dbg.appendLine(`[EDIT ATTEMPT] file: ${filePath}`);
        dbg.appendLine(`[EDIT ATTEMPT] oldString len=${oldString.length} norm=${nOld.length} crlf=${oldString.includes('\r\n')} tab=${oldString.includes('\t')}`);
        dbg.appendLine(`[EDIT ATTEMPT] file len=${originalContent.length} norm=${nFile.length} crlf=${originalContent.includes('\r\n')} tab=${originalContent.includes('\t')}`);
        dbg.appendLine(`[EDIT ATTEMPT] old first 150: ${JSON.stringify(nOld.slice(0, 150))}`);
        const idxRes = nFile.indexOf(nOld);
        dbg.appendLine(`[EDIT ATTEMPT] normalized indexOf: ${idxRes}`);
        if (idxRes === -1) {
          const p30 = nOld.slice(0, 30);
          const p30i = nFile.indexOf(p30);
          dbg.appendLine(`[EDIT ATTEMPT] first30 indexOf: ${p30i}`);
          if (p30i !== -1) {
            const sl = nFile.slice(p30i, p30i + nOld.length + 10);
            for (let c = 0; c < Math.min(nOld.length, sl.length); c++) {
              if (nOld[c] !== sl[c]) {
                dbg.appendLine(`[EDIT ATTEMPT] DIVERGE@${c}: old=${JSON.stringify(nOld.slice(Math.max(0,c-10), c+30))} file=${JSON.stringify(sl.slice(Math.max(0,c-10), c+30))}`);
                dbg.appendLine(`[EDIT ATTEMPT] codes: old=${nOld.charCodeAt(c)} file=${sl.charCodeAt(c)}`);
                break;
              }
            }
          }
        }
        dbg.appendLine('---');
      }

      const replacement = replaceInOriginal(originalContent, oldString, newString, replaceAll);

      if (!replacement.replaced) {
        const normalizedContent = normalizeToLf(originalContent);
        const normalizedOld = normalizeToLf(oldString);
        const matches = findAllIndices(normalizedContent, normalizedOld);

        // === DEBUG: Log mismatch details to Output channel ===
        const debugChannel = vscode.window.createOutputChannel('EchoDE Edit Debug', { log: true });
        debugChannel.appendLine(`[EDIT FAIL] file: ${filePath}`);
        debugChannel.appendLine(`[EDIT FAIL] normalizedOld length: ${normalizedOld.length}`);
        debugChannel.appendLine(`[EDIT FAIL] normalizedContent length: ${normalizedContent.length}`);
        debugChannel.appendLine(`[EDIT FAIL] matches found: ${matches.length}`);
        debugChannel.appendLine(`[EDIT FAIL] originalContent has CRLF: ${originalContent.includes('\r\n')}`);
        debugChannel.appendLine(`[EDIT FAIL] oldString has CRLF: ${oldString.includes('\r\n')}`);
        // Find best partial match to diagnose WHERE mismatch starts
        const searchIdx = normalizedContent.indexOf(normalizedOld.slice(0, 30));
        if (searchIdx !== -1) {
          debugChannel.appendLine(`[EDIT FAIL] First 30 chars of old_string found at index ${searchIdx} (line ${indexToLineNumber(normalizedContent, searchIdx)})`);
          const fileSlice = normalizedContent.slice(searchIdx, searchIdx + normalizedOld.length + 20);
          // Find first char mismatch
          let mismatchIdx = -1;
          for (let ci = 0; ci < normalizedOld.length && ci < fileSlice.length; ci++) {
            if (normalizedOld[ci] !== fileSlice[ci]) {
              mismatchIdx = ci;
              break;
            }
          }
          if (mismatchIdx !== -1) {
            const ctxStart = Math.max(0, mismatchIdx - 10);
            const ctxEnd = Math.min(normalizedOld.length, mismatchIdx + 10);
            debugChannel.appendLine(`[EDIT FAIL] First mismatch at char ${mismatchIdx}`);
            debugChannel.appendLine(`[EDIT FAIL] old_string around mismatch: ${JSON.stringify(normalizedOld.slice(ctxStart, ctxEnd))}`);
            debugChannel.appendLine(`[EDIT FAIL] file content around mismatch: ${JSON.stringify(fileSlice.slice(ctxStart, ctxEnd))}`);
            debugChannel.appendLine(`[EDIT FAIL] old_string charCode at mismatch: ${normalizedOld.charCodeAt(mismatchIdx)}`);
            debugChannel.appendLine(`[EDIT FAIL] file charCode at mismatch: ${fileSlice.charCodeAt(mismatchIdx)}`);
          } else if (normalizedOld.length > fileSlice.length) {
            debugChannel.appendLine(`[EDIT FAIL] old_string is LONGER than remaining file content from match point (old: ${normalizedOld.length}, file slice: ${fileSlice.length})`);
          } else {
            debugChannel.appendLine(`[EDIT FAIL] First 30 chars matched but full match failed — possible trailing content difference`);
          }
        } else {
          // Try even shorter prefix
          const shortIdx = normalizedContent.indexOf(normalizedOld.slice(0, 15));
          if (shortIdx !== -1) {
            debugChannel.appendLine(`[EDIT FAIL] First 15 chars found at index ${shortIdx} (line ${indexToLineNumber(normalizedContent, shortIdx)})`);
          } else {
            debugChannel.appendLine(`[EDIT FAIL] Even first 15 chars of old_string NOT found in file — AI likely hallucinated the content`);
          }
          debugChannel.appendLine(`[EDIT FAIL] old_string first 80 chars: ${JSON.stringify(normalizedOld.slice(0, 80))}`);
        }
        debugChannel.appendLine('---');
        // === END DEBUG ===

        if (!replaceAll && matches.length >= 2) {
          const lineNumbers = matches
            .slice(0, 5)
            .map(idx => indexToLineNumber(normalizedContent, idx));
          const more = matches.length > 5 ? ` (and ${matches.length - 5} more)` : '';
          return {
            success: false,
            error:
              `old_string must be unique in the file unless replace_all is true. ` +
              `Found ${matches.length} occurrences at lines: ${lineNumbers.join(', ')}${more}. ` +
              `Tip: include more surrounding context in old_string or set replace_all=true if appropriate.`,
          };
        }

        const anchorContext = findFirstAnchorContext(normalizedContent, oldString);
        if (anchorContext) {
          return {
            success: false,
            error:
              `old_string was not found in the file. ` +
              `However, an anchor line from your old_string WAS found ("${anchorContext.anchor}"). ` +
              `Here is nearby context (lines ${anchorContext.startLine}-${anchorContext.endLine}):\n` +
              `${anchorContext.snippet}\n` +
              `Action: re-run read_file for this region and copy the exact old_string from the current file contents (do not guess).`,
          };
        }

        return {
          success: false,
          error:
            'old_string was not found in the file. Action: call read_file on the file and copy the exact text to replace from the tool output (do not guess).',
        };
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
