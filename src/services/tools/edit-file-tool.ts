import * as vscode from 'vscode';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';

export class EditFileTool implements ITool {
  name = 'edit_file';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const filePath = parameters.path as string;
    const edits = parameters.edits as Array<{
      oldString: string;
      newString: string;
      replaceAll?: boolean;
    }>;

    if (!filePath) {
      return { success: false, error: 'File path is required' };
    }

    if (!edits || !Array.isArray(edits) || edits.length === 0) {
      return { success: false, error: 'Edits array is required' };
    }

    try {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        return { success: false, error: 'No workspace folder open' };
      }

      const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);
      const uri = vscode.Uri.file(absolutePath);

      // Read original content
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

      let content = originalContent;

      // Helper: find a unique match where leading indentation (spaces/tabs) may differ
      const findIndentInsensitiveMatch = (
        fileContent: string,
        pattern: string
      ): { matchedText: string } | null => {
        const fileLines = fileContent.split('\n');
        const patternLines = pattern.split('\n');

        const normalize = (line: string) => line.replace(/^[ \t]*/, '');

        let foundMatch: { matchedText: string } | null = null;

        outer: for (let start = 0; start <= fileLines.length - patternLines.length; start++) {
          for (let offset = 0; offset < patternLines.length; offset++) {
            if (normalize(fileLines[start + offset]) !== normalize(patternLines[offset])) {
              continue outer;
            }
          }

          const candidateLines = fileLines.slice(start, start + patternLines.length);
          const candidateText = candidateLines.join('\n');

          if (foundMatch) {
            // More than one possible match – require the caller to be more specific
            return null;
          }

          foundMatch = { matchedText: candidateText };
        }

        return foundMatch;
      };

      // Validate all edits first
      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];

        if (!edit.oldString) {
          return {
            success: false,
            error: `Edit ${i + 1}: oldString is required`,
          };
        }

        if (edit.newString === undefined) {
          return {
            success: false,
            error: `Edit ${i + 1}: newString is required`,
          };
        }

        if (edit.oldString === edit.newString) {
          return {
            success: false,
            error: `Edit ${i + 1}: oldString and newString are identical`,
          };
        }

        if (!content.includes(edit.oldString)) {
          // Fallback: try to match while ignoring leading indentation differences (tabs vs spaces)
          const indentMatch = findIndentInsensitiveMatch(content, edit.oldString);

          if (indentMatch) {
            // Use the exact substring from the file for the remainder of validation + application
            edit.oldString = indentMatch.matchedText;
          } else {
            // Try to find similar content to help debug
            const lines = content.split('\n');
            const oldStringLines = edit.oldString.split('\n');
            const firstLine = oldStringLines[0]?.trim();
            
            // Find lines containing first line of oldString
            const similarMatches: string[] = [];
            lines.forEach((line, idx) => {
              if (firstLine && line.includes(firstLine)) {
                const start = Math.max(0, idx - 1);
                const end = Math.min(lines.length, idx + 3);
                const snippet = lines.slice(start, end)
                  .map((l, i) => `${start + i + 1}: ${l}`)
                  .join('\n');
                similarMatches.push(snippet);
              }
            });

            let errorMsg = `Edit ${i + 1}: oldString not found in file.\n\nPossible causes:\n- File content changed (re-read the file)\n- Whitespace/indentation mismatch\n- Missing surrounding context\n\noldString you tried to match:\n${edit.oldString.substring(0, 200)}${edit.oldString.length > 200 ? '...' : ''}`;
            
            if (similarMatches.length > 0) {
              errorMsg += `\n\nSimilar content found (you may need more context):\n${similarMatches[0]}`;
            }

            return {
              success: false,
              error: errorMsg,
            };
          }
        }

        if (!edit.replaceAll) {
          const occurrences = content.split(edit.oldString).length - 1;
          if (occurrences > 1) {
            // Show locations where oldString appears
            const lines = content.split('\n');
            const locations: number[] = [];
            let searchPos = 0;
            let foundIndex = content.indexOf(edit.oldString, searchPos);
            
            while (foundIndex !== -1) {
              // Find which line this occurrence is on
              const beforeMatch = content.substring(0, foundIndex);
              const lineNum = beforeMatch.split('\n').length;
              locations.push(lineNum);
              
              searchPos = foundIndex + 1;
              foundIndex = content.indexOf(edit.oldString, searchPos);
            }

            return {
              success: false,
              error: `Edit ${i + 1}: oldString appears ${occurrences} times at lines: ${locations.slice(0, 5).join(', ')}${locations.length > 5 ? '...' : ''}.\n\nSolutions:\n1. Add more surrounding context to make it unique\n2. Set replaceAll: true to change all occurrences\n\nCurrent oldString:\n${edit.oldString.substring(0, 150)}${edit.oldString.length > 150 ? '...' : ''}`,
            };
          }
        }
      }

      // Apply edits sequentially
      const appliedEdits: Array<{
        oldString: string;
        newString: string;
        replaceAll: boolean;
      }> = [];

      for (const edit of edits) {
        if (edit.replaceAll) {
          content = content.split(edit.oldString).join(edit.newString);
        } else {
          const index = content.indexOf(edit.oldString);
          if (index !== -1) {
            content = content.substring(0, index) + edit.newString + content.substring(index + edit.oldString.length);
          }
        }

        appliedEdits.push({
          oldString: edit.oldString,
          newString: edit.newString,
          replaceAll: edit.replaceAll ?? false,
        });
      }

      // Write updated content
      const contentBytes = Buffer.from(content, 'utf8');
      await vscode.workspace.fs.writeFile(uri, contentBytes);

      // Truncate content if too large to prevent message passing failure
      const MAX_CONTENT_SIZE = 1024 * 512; // 512KB
      let returnOriginal = originalContent;
      let returnNew = content;
      let truncated = false;

      if (originalContent.length > MAX_CONTENT_SIZE || content.length > MAX_CONTENT_SIZE) {
        returnOriginal = originalContent.substring(0, MAX_CONTENT_SIZE) + '\n...(truncated)...';
        returnNew = content.substring(0, MAX_CONTENT_SIZE) + '\n...(truncated)...';
        truncated = true;
      }

      return {
        success: true,
        data: {
          path: filePath,
          editsApplied: appliedEdits.length,
          edits: appliedEdits,
          originalContent: returnOriginal,
          newContent: returnNew,
          truncated,
        },
      };
    } catch (error) {
      console.error('EditFileTool error:', error);
      return {
        success: false,
        error: `Failed to edit file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
