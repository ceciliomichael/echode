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

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const filePath = parameters.path as string;
    const patchContent = parameters.patch as string;

    if (!filePath) {
      return { success: false, error: 'File path is required' };
    }

    if (!patchContent) {
      return { success: false, error: 'Patch content is required' };
    }

    try {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        return { success: false, error: 'No workspace folder open' };
      }

      const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);
      const uri = vscode.Uri.file(absolutePath);

      let originalContent: string;
      try {
        const fileContent = await vscode.workspace.fs.readFile(uri);
        originalContent = Buffer.from(fileContent).toString('utf8');
      } catch (error) {
        return {
          success: false,
          error: `File not found: ${filePath}`,
        };
      }

      const parsedPatch = this.parsePatch(patchContent);
      
      if (!parsedPatch) {
        return {
          success: false,
          error: 'Invalid patch format. Expected unified diff format.',
        };
      }

      const applyResult = this.applyPatch(originalContent, parsedPatch);

      if (!applyResult.success) {
        return {
          success: false,
          error: applyResult.error,
        };
      }

      const newContent = applyResult.content!;

      const contentBytes = Buffer.from(newContent, 'utf8');
      await vscode.workspace.fs.writeFile(uri, contentBytes);

      const MAX_CONTENT_SIZE = 1024 * 512;
      let returnOriginal = originalContent;
      let returnNew = newContent;
      let truncated = false;

      if (originalContent.length > MAX_CONTENT_SIZE || newContent.length > MAX_CONTENT_SIZE) {
        returnOriginal = originalContent.substring(0, MAX_CONTENT_SIZE) + '\n...(truncated)...';
        returnNew = newContent.substring(0, MAX_CONTENT_SIZE) + '\n...(truncated)...';
        truncated = true;
      }

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
      console.error('PatchFileTool error:', error);
      return {
        success: false,
        error: `Failed to apply patch: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

  private applyPatch(content: string, patch: ParsedPatch): { success: boolean; content?: string; error?: string } {
    const fileLines = content.split('\n');
    let result = [...fileLines];

    for (let hunkIndex = 0; hunkIndex < patch.hunks.length; hunkIndex++) {
      const hunk = patch.hunks[hunkIndex];
      
      const applyResult = this.applyHunk(result, hunk, hunkIndex);
      
      if (!applyResult.success) {
        return applyResult;
      }
      
      result = applyResult.lines!;
    }

    return {
      success: true,
      content: result.join('\n'),
    };
  }

  private applyHunk(
    fileLines: string[],
    hunk: Hunk,
    hunkIndex: number
  ): { success: boolean; lines?: string[]; error?: string } {
    const targetLineIndex = hunk.oldStart - 1;

    if (targetLineIndex < 0 || targetLineIndex > fileLines.length) {
      return {
        success: false,
        error: `Hunk ${hunkIndex + 1}: Line ${hunk.oldStart} is out of range (file has ${fileLines.length} lines)`,
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
        return {
          success: false,
          error: `Hunk ${hunkIndex + 1}: Context mismatch at line ${actualIndex + 1}. Expected "${expected.content}" but file ended.`,
        };
      }

      const actual = fileLines[actualIndex];

      if (actual !== expected.content) {
        return {
          success: false,
          error: `Hunk ${hunkIndex + 1}: Context mismatch at line ${actualIndex + 1}.\nExpected: "${expected.content}"\nActual: "${actual}"`,
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

    return {
      success: true,
      lines: result,
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
