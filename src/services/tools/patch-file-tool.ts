import * as vscode from 'vscode';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';

interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: HunkLine[];
}

interface HunkLine {
  type: 'context' | 'add' | 'remove';
  content: string;
}

interface ParsedPatch {
  oldPath: string | null;
  newPath: string | null;
  hunks: Hunk[];
}

export class PatchFileTool implements ITool {
  name = 'patch_file';

  private normalizeLineEnding(line: string): string {
    return line.replace(/\r$/, '');
  }

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const filePath = parameters.path as string;
    const patchContent = parameters.patch as string;

    console.log('[PATCH_FILE] ==================== START ====================');
    console.log('[PATCH_FILE] Target file:', filePath);

    if (!filePath) {
      console.log('[PATCH_FILE] ERROR: No file path provided');
      return { success: false, error: 'File path is required' };
    }

    if (!patchContent) {
      console.log('[PATCH_FILE] ERROR: No patch content provided');
      return { success: false, error: 'Patch content is required' };
    }

    console.log('[PATCH_FILE] Patch content length:', patchContent.length, 'characters');
    console.log('[PATCH_FILE] Patch preview:', patchContent.substring(0, 200).replace(/\n/g, '\\n'));

    try {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        console.log('[PATCH_FILE] ERROR: No workspace folder open');
        return { success: false, error: 'No workspace folder open' };
      }

      const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);
      const uri = vscode.Uri.file(absolutePath);
      console.log('[PATCH_FILE] Absolute path:', absolutePath);

      let originalContent: string;
      try {
        const fileContent = await vscode.workspace.fs.readFile(uri);
        originalContent = Buffer.from(fileContent).toString('utf8');
        console.log('[PATCH_FILE] File read successfully, length:', originalContent.length, 'characters');
        console.log('[PATCH_FILE] File has CRLF:', originalContent.includes('\r\n'));
        console.log('[PATCH_FILE] Total lines:', originalContent.split('\n').length);
      } catch (error) {
        console.log('[PATCH_FILE] ERROR: File not found:', error);
        return {
          success: false,
          error: `File not found: ${filePath}`,
        };
      }

      const parsedPatch = this.parsePatch(patchContent);
      
      if (!parsedPatch) {
        console.log('[PATCH_FILE] ERROR: Failed to parse patch');
        return {
          success: false,
          error: 'PATCH_FORMAT_INVALID: Invalid patch format. Expected unified diff format. Regenerate patch from current file content.',
        };
      }

      console.log('[PATCH_FILE] Parsed', parsedPatch.hunks.length, 'hunk(s)');
      parsedPatch.hunks.forEach((hunk, idx) => {
        console.log(`[PATCH_FILE] Hunk ${idx + 1}: @@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@ (${hunk.lines.length} lines)`);
      });

      const applyResult = this.applyPatch(originalContent, parsedPatch, filePath);

      if (!applyResult.success) {
        console.log('[PATCH_FILE] ERROR: Patch application failed:', applyResult.error);
        return {
          success: false,
          error: applyResult.error,
        };
      }

      const newContent = applyResult.content!;
      console.log('[PATCH_FILE] Patch applied successfully');
      console.log('[PATCH_FILE] New content length:', newContent.length, 'characters');
      console.log('[PATCH_FILE] New total lines:', newContent.split('\n').length);

      const contentBytes = Buffer.from(newContent, 'utf8');
      await vscode.workspace.fs.writeFile(uri, contentBytes);
      console.log('[PATCH_FILE] File written successfully');

      const MAX_CONTENT_SIZE = 1024 * 512;
      let returnOriginal = originalContent;
      let returnNew = newContent;
      let truncated = false;

      if (originalContent.length > MAX_CONTENT_SIZE || newContent.length > MAX_CONTENT_SIZE) {
        returnOriginal = originalContent.substring(0, MAX_CONTENT_SIZE) + '\n...(truncated)...';
        returnNew = newContent.substring(0, MAX_CONTENT_SIZE) + '\n...(truncated)...';
        truncated = true;
      }

      console.log('[PATCH_FILE] ==================== SUCCESS ====================');
      return {
        success: true,
        data: {
          path: filePath,
          hunksApplied: parsedPatch.hunks.length,
          originalContent: returnOriginal,
          newContent: returnNew,
          truncated,
          linesAdded: this.countLines(parsedPatch, 'add'),
          linesRemoved: this.countLines(parsedPatch, 'remove'),
        },
      };
    } catch (error) {
      console.error('[PATCH_FILE] ==================== EXCEPTION ====================');
      console.error('[PATCH_FILE] Exception:', error);
      return {
        success: false,
        error: `PATCH_APPLY_FAILED: ${error instanceof Error ? error.message : 'Unknown error'}. Call read_file again and generate NEW patch.`,
      };
    }
  }

  private parsePatch(patchContent: string): ParsedPatch | null {
    const lines = patchContent.split('\n');
    const patch: ParsedPatch = {
      oldPath: null,
      newPath: null,
      hunks: [],
    };

    let i = 0;

    while (i < lines.length && (lines[i].startsWith('---') || lines[i].startsWith('+++'))) {
      if (lines[i].startsWith('---')) {
        patch.oldPath = lines[i].substring(4).trim();
      } else if (lines[i].startsWith('+++')) {
        patch.newPath = lines[i].substring(4).trim();
      }
      i++;
    }

    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith('@@')) {
        const hunk = this.parseHunk(lines, i);
        if (!hunk) {
          return null;
        }
        patch.hunks.push(hunk.hunk);
        i = hunk.nextIndex;
      } else {
        i++;
      }
    }

    if (patch.hunks.length === 0) {
      return null;
    }

    return patch;
  }

  private parseHunk(lines: string[], startIndex: number): { hunk: Hunk; nextIndex: number } | null {
    const hunkHeader = lines[startIndex];
    const match = hunkHeader.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);

    if (!match) {
      return null;
    }

    const oldStart = parseInt(match[1], 10);
    const oldCount = match[2] ? parseInt(match[2], 10) : 1;
    const newStart = parseInt(match[3], 10);
    const newCount = match[4] ? parseInt(match[4], 10) : 1;

    const hunkLines: HunkLine[] = [];
    let i = startIndex + 1;

    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith('@@')) {
        break;
      }

      if (line.startsWith('+')) {
        hunkLines.push({
          type: 'add',
          content: line.substring(1),
        });
      } else if (line.startsWith('-')) {
        hunkLines.push({
          type: 'remove',
          content: line.substring(1),
        });
      } else if (line.startsWith(' ')) {
        hunkLines.push({
          type: 'context',
          content: line.substring(1),
        });
      } else if (line.trim() === '') {
        hunkLines.push({
          type: 'context',
          content: '',
        });
      } else {
        break;
      }

      i++;
    }

    return {
      hunk: {
        oldStart,
        oldCount,
        newStart,
        newCount,
        lines: hunkLines,
      },
      nextIndex: i,
    };
  }

  private applyPatch(content: string, patch: ParsedPatch, filePath: string): { success: boolean; content?: string; error?: string } {
    const fileLines = content.split('\n');
    console.log('[PATCH_FILE] applyPatch: Starting with', fileLines.length, 'lines');
    
    // Validate hunks are non-empty and sorted
    for (let i = 0; i < patch.hunks.length; i++) {
      const hunk = patch.hunks[i];
      const hasChanges = hunk.lines.some(l => l.type === 'add' || l.type === 'remove');
      if (!hasChanges) {
        console.log(`[PATCH_FILE] ERROR: Hunk ${i + 1} has no changes (pure context)`);
        return {
          success: false,
          error: `PATCH_FORMAT_INVALID: Hunk ${i + 1} contains no actual changes. Regenerate patch with real modifications.`,
        };
      }
      
      if (i > 0 && hunk.oldStart <= patch.hunks[i - 1].oldStart) {
        console.log(`[PATCH_FILE] ERROR: Hunks not sorted`);
        return {
          success: false,
          error: `PATCH_FORMAT_INVALID: Hunks must be sorted by line number. Regenerate patch in correct order.`,
        };
      }
    }

    let result = [...fileLines];
    let lineOffset = 0; // Track cumulative line offset from previous hunks

    for (let hunkIndex = 0; hunkIndex < patch.hunks.length; hunkIndex++) {
      const hunk = patch.hunks[hunkIndex];
      console.log(`[PATCH_FILE] Applying hunk ${hunkIndex + 1}/${patch.hunks.length}, offset=${lineOffset}`);
      
      const applyResult = this.applyHunk(result, hunk, hunkIndex, lineOffset, filePath);
      
      if (!applyResult.success) {
        return applyResult;
      }
      
      result = applyResult.lines!;
      lineOffset = applyResult.newOffset!;
      console.log(`[PATCH_FILE] Hunk ${hunkIndex + 1} applied, new offset=${lineOffset}, result has ${result.length} lines`);
    }

    return {
      success: true,
      content: result.join('\n'),
    };
  }

  private applyHunk(
    fileLines: string[],
    hunk: Hunk,
    hunkIndex: number,
    lineOffset: number,
    filePath: string
  ): { success: boolean; lines?: string[]; newOffset?: number; error?: string } {
    const targetLineIndex = (hunk.oldStart - 1) + lineOffset;
    console.log(`[PATCH_FILE] applyHunk ${hunkIndex + 1}: targetLineIndex=${targetLineIndex} (oldStart=${hunk.oldStart}, offset=${lineOffset})`);

    if (targetLineIndex < 0 || targetLineIndex > fileLines.length) {
      console.log(`[PATCH_FILE] ERROR: Line out of range`);
      return {
        success: false,
        error: `LINE_OUT_OF_RANGE: Hunk ${hunkIndex + 1} targets line ${hunk.oldStart} (adjusted: ${targetLineIndex + 1}) but file has ${fileLines.length} lines. File changed since read_file - call read_file again and generate NEW patch.`,
      };
    }

    const contextLines: string[] = [];
    const removedLines: string[] = [];
    const addedLines: string[] = [];

    for (const line of hunk.lines) {
      if (line.type === 'context') {
        contextLines.push(line.content);
      } else if (line.type === 'remove') {
        removedLines.push(line.content);
      } else if (line.type === 'add') {
        addedLines.push(line.content);
      }
    }

    let fileIndex = targetLineIndex;
    let hunkLineIndex = 0;

    const expectedLines: Array<{ content: string; type: 'context' | 'remove' }> = [];
    
    for (const line of hunk.lines) {
      if (line.type === 'context' || line.type === 'remove') {
        expectedLines.push({ content: line.content, type: line.type });
      }
    }

    for (let i = 0; i < expectedLines.length; i++) {
      const expected = expectedLines[i];
      const actualIndex = targetLineIndex + i;

      if (actualIndex >= fileLines.length) {
        console.log(`[PATCH_FILE] ERROR: Context mismatch - file ended`);
        return {
          success: false,
          error: `CONTEXT_MISMATCH: Hunk ${hunkIndex + 1} at line ${actualIndex + 1} - file ended. File changed since read_file. Call read_file again and generate NEW patch from fresh content. Do NOT reuse this patch.`,
        };
      }

      const actual = fileLines[actualIndex];
      const normalizedActual = this.normalizeLineEnding(actual);
      const normalizedExpected = this.normalizeLineEnding(expected.content);

      if (normalizedActual !== normalizedExpected) {
        console.log(`[PATCH_FILE] ERROR: Context mismatch at line ${actualIndex + 1}`);
        console.log(`[PATCH_FILE] Expected (normalized): "${normalizedExpected}"`);
        console.log(`[PATCH_FILE] Actual (normalized): "${normalizedActual}"`);
        console.log(`[PATCH_FILE] Expected (raw): "${expected.content}"`);
        console.log(`[PATCH_FILE] Actual (raw): "${actual}"`);
        
        // Check if it's only whitespace difference
        if (normalizedActual.trim() === normalizedExpected.trim()) {
          return {
            success: false,
            error: `WHITESPACE_MISMATCH: Hunk ${hunkIndex + 1} at line ${actualIndex + 1} has whitespace-only difference. Match indentation exactly from read_file output.`,
          };
        }
        
        return {
          success: false,
          error: `CONTEXT_MISMATCH: Hunk ${hunkIndex + 1} at line ${actualIndex + 1} in "${filePath}".\nExpected: "${normalizedExpected}"\nActual: "${normalizedActual}"\n\nFile changed since read_file. Call read_file again and generate NEW patch from that fresh content. Do NOT reuse this patch.`,
        };
      }
    }

    const result = [...fileLines];
    const newLines: string[] = [];

    for (const line of hunk.lines) {
      if (line.type === 'context' || line.type === 'add') {
        newLines.push(line.content);
      }
    }

    result.splice(targetLineIndex, expectedLines.length, ...newLines);
    
    const linesAdded = newLines.length;
    const linesRemoved = expectedLines.length;
    const newOffset = lineOffset + (linesAdded - linesRemoved);

    console.log(`[PATCH_FILE] Hunk applied: removed ${linesRemoved}, added ${linesAdded}, new offset=${newOffset}`);

    return {
      success: true,
      lines: result,
      newOffset,
    };
  }

  private countLines(patch: ParsedPatch, type: 'add' | 'remove'): number {
    let count = 0;
    for (const hunk of patch.hunks) {
      for (const line of hunk.lines) {
        if (line.type === type) {
          count++;
        }
      }
    }
    return count;
  }
}
