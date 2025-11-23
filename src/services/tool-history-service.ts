import * as vscode from 'vscode';
import * as path from 'path';
import type { ToolExecutionState } from '../types/tool-execution';
import { getCreatedDirectories } from './tools/utils/workspace-utils';

/**
 * Service for managing tool execution history and undo operations
 */
export class ToolHistoryService {
  /**
   * Undo a single tool execution by reversing its effects
   */
  async undoToolExecution(
    toolExecution: ToolExecutionState,
    workspacePath: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!toolExecution.result?.success || !toolExecution.result.data) {
      console.log(`[ToolHistory] Skipping undo for ${toolExecution.toolName} (no successful result)`);
      return { success: true }; // Nothing to undo if tool failed
    }

    const { toolName } = toolExecution;
    const data = toolExecution.result.data as Record<string, unknown>;
    console.log(`[ToolHistory] Undoing ${toolName}:`, data.path || data);

    try {
      switch (toolName) {
        case 'write_to_file':
          return await this.undoWriteFile(data, workspacePath);
        
        case 'apply_diff':
          return await this.undoApplyDiff(data, workspacePath);
        
        case 'delete_file':
          return await this.undoDeleteFile(data, workspacePath);
        
        case 'todo_write':
          // Todos are handled separately in the UI layer
          return { success: true };
        
        // Read-only tools don't need undo
        case 'read_file':
        case 'list_files':
        case 'grep_search':
        case 'glob_search':
        case 'todo_read':
          return { success: true };
        
        default:
          console.warn(`[ToolHistory] Unknown tool for undo: ${toolName}`);
          return { success: true };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to undo ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Undo multiple tool executions in reverse order
   */
  async undoToolExecutions(
    toolExecutions: Map<string, ToolExecutionState>,
    workspacePath: string
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // Convert to array and reverse (undo in reverse order of execution)
    const executionsArray = Array.from(toolExecutions.values()).reverse();
    
    for (const execution of executionsArray) {
      const result = await this.undoToolExecution(execution, workspacePath);
      if (!result.success && result.error) {
        errors.push(result.error);
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Redo a single tool execution by re-applying its effects
   */
  async redoToolExecution(
    toolExecution: ToolExecutionState,
    workspacePath: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!toolExecution.result?.success || !toolExecution.result.data) {
      console.log(`[ToolHistory] Skipping redo for ${toolExecution.toolName} (no successful result)`);
      return { success: true }; // Nothing to redo if tool failed
    }

    const { toolName } = toolExecution;
    const data = toolExecution.result.data as Record<string, unknown>;
    console.log(`[ToolHistory] Redoing ${toolName}:`, data.path || data);

    try {
      switch (toolName) {
        case 'write_to_file':
          return await this.redoWriteFile(data, workspacePath);
        
        case 'apply_diff':
          return await this.redoApplyDiff(data, workspacePath);
        
        case 'delete_file':
          return await this.redoDeleteFile(data, workspacePath);
        
        case 'todo_write':
          // Todos are handled separately in the UI layer
          return { success: true };
        
        // Read-only tools don't need redo
        case 'read_file':
        case 'list_files':
        case 'grep_search':
        case 'glob_search':
        case 'todo_read':
          return { success: true };
        
        default:
          console.warn(`[ToolHistory] Unknown tool for redo: ${toolName}`);
          return { success: true };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to redo ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Redo multiple tool executions in original order
   */
  async redoToolExecutions(
    toolExecutions: Map<string, ToolExecutionState>,
    workspacePath: string
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // Convert to array in original order (redo in forward order)
    const executionsArray = Array.from(toolExecutions.values());
    
    for (const execution of executionsArray) {
      const result = await this.redoToolExecution(execution, workspacePath);
      if (!result.success && result.error) {
        errors.push(result.error);
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Undo write_to_file operation
   */
  private async undoWriteFile(
    data: Record<string, unknown>,
    workspacePath: string
  ): Promise<{ success: boolean; error?: string }> {
    const filePath = data.path as string;
    const action = data.action as string;
    const oldContent = data.oldContent as string | null;
    const createdDirectories = (data.createdDirectories as string[]) || [];

    const absolutePath = path.join(workspacePath, filePath);
    const uri = vscode.Uri.file(absolutePath);

    if (action === 'created') {
      // File was created, delete it
      try {
        // Close the file tab if it's open
        const openEditor = vscode.window.visibleTextEditors.find(
          (editor) => editor.document.uri.toString() === uri.toString()
        );
        
        if (openEditor) {
          // Close the editor tab
          await vscode.window.showTextDocument(openEditor.document, openEditor.viewColumn);
          await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
          console.log(`[ToolHistory] Closed tab for deleted file: ${filePath}`);
        }
        
        // Delete the file
        await vscode.workspace.fs.delete(uri, { recursive: false, useTrash: false });
        
        // Clean up empty directories that were created
        await this.cleanupEmptyDirectories(createdDirectories, workspacePath);
        
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
        await vscode.workspace.fs.writeFile(uri, contentBytes);
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
   * Undo apply_diff operation
   */
  private async undoApplyDiff(
    data: Record<string, unknown>,
    workspacePath: string
  ): Promise<{ success: boolean; error?: string }> {
    const filePath = data.path as string;
    const oldContent = data.oldContent as string;

    const absolutePath = path.join(workspacePath, filePath);
    const uri = vscode.Uri.file(absolutePath);

    try {
      // Restore original content before diff was applied
      const contentBytes = Buffer.from(oldContent, 'utf8');
      await vscode.workspace.fs.writeFile(uri, contentBytes);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to undo diff for file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Undo file edit operation
   */
  private async undoEditFile(
    data: Record<string, unknown>,
    workspacePath: string
  ): Promise<{ success: boolean; error?: string }> {
    const filePath = data.path as string;
    const originalContent = data.originalContent as string;

    const absolutePath = path.join(workspacePath, filePath);
    const uri = vscode.Uri.file(absolutePath);

    try {
      // Restore original content
      const contentBytes = Buffer.from(originalContent, 'utf8');
      await vscode.workspace.fs.writeFile(uri, contentBytes);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to restore file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Undo delete_file operation
   */
  private async undoDeleteFile(
    data: Record<string, unknown>,
    workspacePath: string
  ): Promise<{ success: boolean; error?: string }> {
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

      // Restore deleted file
      const contentBytes = Buffer.from(deletedContent, 'utf8');
      await vscode.workspace.fs.writeFile(uri, contentBytes);
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
    data: Record<string, unknown>,
    workspacePath: string
  ): Promise<{ success: boolean; error?: string }> {
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
      await vscode.workspace.fs.writeFile(uri, contentBytes);
      
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
   * Redo apply_diff operation
   */
  private async redoApplyDiff(
    data: Record<string, unknown>,
    workspacePath: string
  ): Promise<{ success: boolean; error?: string }> {
    const filePath = data.path as string;
    const newContent = data.newContent as string;

    const absolutePath = path.join(workspacePath, filePath);
    const uri = vscode.Uri.file(absolutePath);

    try {
      // Re-apply diff content
      const contentBytes = Buffer.from(newContent, 'utf8');
      await vscode.workspace.fs.writeFile(uri, contentBytes);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to redo diff for file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Redo file edit operation
   */
  private async redoEditFile(
    data: Record<string, unknown>,
    workspacePath: string
  ): Promise<{ success: boolean; error?: string }> {
    const filePath = data.path as string;
    const newContent = data.newContent as string;

    const absolutePath = path.join(workspacePath, filePath);
    const uri = vscode.Uri.file(absolutePath);

    try {
      // Re-apply new content
      const contentBytes = Buffer.from(newContent, 'utf8');
      await vscode.workspace.fs.writeFile(uri, contentBytes);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to redo edit file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Redo delete_file operation
   */
  private async redoDeleteFile(
    data: Record<string, unknown>,
    workspacePath: string
  ): Promise<{ success: boolean; error?: string }> {
    const filePath = data.path as string;

    const absolutePath = path.join(workspacePath, filePath);
    const uri = vscode.Uri.file(absolutePath);

    try {
      await vscode.workspace.fs.delete(uri, { recursive: false, useTrash: false });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to redo delete file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }


  /**
   * Clean up empty directories that were created during file operations
   * Deletes directories in reverse order (deepest first) if they are empty
   */
  private async cleanupEmptyDirectories(
    directories: string[],
    workspacePath: string
  ): Promise<void> {
    console.log(`[ToolHistory] Cleaning up ${directories.length} directories (if empty)`);
    
    // Process directories in reverse order (deepest first)
    for (let i = directories.length - 1; i >= 0; i--) {
      const dirPath = directories[i];
      
      // Safety check: never delete workspace root
      if (dirPath === workspacePath || dirPath.length <= workspacePath.length) {
        console.log(`[ToolHistory] Skipping workspace root: ${dirPath}`);
        continue;
      }
      
      try {
        const dirUri = vscode.Uri.file(dirPath);
        const contents = await vscode.workspace.fs.readDirectory(dirUri);
        
        // Only delete if directory is empty
        if (contents.length === 0) {
          console.log(`[ToolHistory] Deleting empty directory: ${dirPath}`);
          await vscode.workspace.fs.delete(dirUri, { recursive: false, useTrash: false });
        } else {
          console.log(`[ToolHistory] Directory not empty (${contents.length} items), keeping: ${dirPath}`);
        }
      } catch (error) {
        console.log(`[ToolHistory] Could not cleanup directory ${dirPath}:`, error instanceof Error ? error.message : 'Unknown error');
        // Ignore errors - directory might already be deleted or not accessible
        continue;
      }
    }
  }
}
