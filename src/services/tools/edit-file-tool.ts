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
          return {
            success: false,
            error: `Edit ${i + 1}: oldString not found in file`,
          };
        }

        if (!edit.replaceAll) {
          const occurrences = content.split(edit.oldString).length - 1;
          if (occurrences > 1) {
            return {
              success: false,
              error: `Edit ${i + 1}: oldString appears ${occurrences} times. Set replaceAll: true or make it unique`,
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
