import * as vscode from 'vscode';
import * as path from 'path';
import type { IToolHistoryHandler } from './handler.interface';
import type { ToolHistoryResult, ToolDataRecord } from '../types';
import { cleanupEmptyDirectories } from '../utils/directory-cleanup';
import { deleteFileWithRetry, writeFileWithRetry } from '../../../utils/fs-retry';

/**
 * Handler for file operation tools: write_to_file, edit, delete_file
 */
export class FileOperationsHandler implements IToolHistoryHandler {
  readonly supportedTools = ['write_to_file', 'edit', 'delete_file'];

  async undo(
    toolName: string,
    data: ToolDataRecord,
    workspacePath: string
  ): Promise<ToolHistoryResult> {
    switch (toolName) {
      case 'write_to_file':
        return this.undoWriteFile(data, workspacePath);
      case 'edit':
        return this.undoEdit(data, workspacePath);
      case 'delete_file':
        return this.undoDeleteFile(data, workspacePath);
      default:
        return { success: true };
    }
  }

  async redo(
    toolName: string,
    data: ToolDataRecord,
    workspacePath: string
  ): Promise<ToolHistoryResult> {
    switch (toolName) {
      case 'write_to_file':
        return this.redoWriteFile(data, workspacePath);
      case 'edit':
        return this.redoEdit(data, workspacePath);
      case 'delete_file':
        return this.redoDeleteFile(data, workspacePath);
      default:
        return { success: true };
    }
  }

  /**
   * Undo write_to_file operation
   */
  private async undoWriteFile(
    data: ToolDataRecord,
    workspacePath: string
  ): Promise<ToolHistoryResult> {
    const filePath = data.path as string;
    const action = data.action as string;
    const oldContent = data.oldContent as string | null;
    const createdDirectories = (data.createdDirectories as string[]) || [];

    const absolutePath = path.join(workspacePath, filePath);
    const uri = vscode.Uri.file(absolutePath);

    if (action === 'created') {
      // File was created, delete it
      try {
        // Close ALL tabs for this file (not just visible editors)
        const targetUri = uri.toString();
        const tabsToClose: vscode.Tab[] = [];

        for (const tabGroup of vscode.window.tabGroups.all) {
          for (const tab of tabGroup.tabs) {
            const tabInput = tab.input;
            if (tabInput && typeof tabInput === 'object' && 'uri' in tabInput && tabInput.uri) {
              if (tabInput.uri.toString() === targetUri) {
                tabsToClose.push(tab);
              }
            }
          }
        }

        // Close all found tabs
        if (tabsToClose.length > 0) {
          await vscode.window.tabGroups.close(tabsToClose);
          console.log(`[ToolHistory] Closed ${tabsToClose.length} tab(s) for deleted file: ${filePath}`);
        }

        // Delete the file with retry logic (handles EBUSY from dev servers/linters)
        await deleteFileWithRetry(uri);

        // Clean up empty directories that were created
        await cleanupEmptyDirectories(createdDirectories, workspacePath);

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: `Failed to delete created file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    } else if (action === 'modified' && oldContent !== null) {
      // File was modified, restore old content
      try {
        const contentBytes = Buffer.from(oldContent, 'utf8');
        await writeFileWithRetry(uri, contentBytes);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: `Failed to restore file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }

    return { success: true };
  }

  /**
   * Undo edit operation
   */
  private async undoEdit(
    data: ToolDataRecord,
    workspacePath: string
  ): Promise<ToolHistoryResult> {
    const filePath = data.path as string;
    const oldContent = data.oldContent as string;

    const absolutePath = path.join(workspacePath, filePath);
    const uri = vscode.Uri.file(absolutePath);

    try {
      // Restore original content before edit was applied (with retry for locked files)
      const contentBytes = Buffer.from(oldContent, 'utf8');
      await writeFileWithRetry(uri, contentBytes);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to undo edit for file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Undo delete_file operation
   */
  private async undoDeleteFile(
    data: ToolDataRecord,
    workspacePath: string
  ): Promise<ToolHistoryResult> {
    const filePath = data.path as string;
    const deletedContent = data.deletedContent as string;

    const absolutePath = path.join(workspacePath, filePath);
    const uri = vscode.Uri.file(absolutePath);

    try {
      // Ensure parent directory exists
      const dirPath = path.dirname(absolutePath);
      const dirUri = vscode.Uri.file(dirPath);
      try {
        await vscode.workspace.fs.createDirectory(dirUri);
      } catch {
        // Directory might already exist
      }

      // Restore deleted file (with retry for locked files)
      const contentBytes = Buffer.from(deletedContent, 'utf8');
      await writeFileWithRetry(uri, contentBytes);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to restore deleted file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Redo write_to_file operation
   */
  private async redoWriteFile(
    data: ToolDataRecord,
    workspacePath: string
  ): Promise<ToolHistoryResult> {
    const filePath = data.path as string;
    const newContent = data.newContent as string;
    const action = data.action as string;

    const absolutePath = path.join(workspacePath, filePath);
    const uri = vscode.Uri.file(absolutePath);

    try {
      // Ensure parent directory exists
      const dirPath = path.dirname(absolutePath);
      const dirUri = vscode.Uri.file(dirPath);
      try {
        await vscode.workspace.fs.createDirectory(dirUri);
      } catch {
        // Directory might already exist
      }

      const contentBytes = Buffer.from(newContent, 'utf8');
      await writeFileWithRetry(uri, contentBytes);

      // If file was originally created, reopen it in editor (matches diagnostics flow)
      if (action === 'created') {
        try {
          const document = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(document, {
            preview: false,
            preserveFocus: true,
          });
          console.log(`[ToolHistory] Reopened recreated file: ${filePath}`);
        } catch (error) {
          console.warn(`[ToolHistory] Could not reopen file: ${filePath}`, error);
          // Don't fail the redo if we can't open the file
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to redo write file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Redo edit operation
   */
  private async redoEdit(
    data: ToolDataRecord,
    workspacePath: string
  ): Promise<ToolHistoryResult> {
    const filePath = data.path as string;
    const newContent = data.newContent as string;

    const absolutePath = path.join(workspacePath, filePath);
    const uri = vscode.Uri.file(absolutePath);

    try {
      // Re-apply edited content (with retry for locked files)
      const contentBytes = Buffer.from(newContent, 'utf8');
      await writeFileWithRetry(uri, contentBytes);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to redo edit for file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Redo delete_file operation
   */
  private async redoDeleteFile(
    data: ToolDataRecord,
    workspacePath: string
  ): Promise<ToolHistoryResult> {
    const filePath = data.path as string;

    const absolutePath = path.join(workspacePath, filePath);
    const uri = vscode.Uri.file(absolutePath);

    try {
      // Delete with retry logic (handles EBUSY from dev servers/linters)
      await deleteFileWithRetry(uri);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to redo delete file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}