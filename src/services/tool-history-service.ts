import * as vscode from 'vscode';
import * as path from 'path';
import type { ToolExecutionState } from '../types/tool-execution';

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
      return { success: true }; // Nothing to undo if tool failed
    }

    const { toolName } = toolExecution;
    const data = toolExecution.result.data as Record<string, unknown>;

    try {
      switch (toolName) {
        case 'write_to_file':
          return await this.undoWriteFile(data, workspacePath);
        
        case 'edit_file':
          return await this.undoEditFile(data, workspacePath);
        
        case 'delete_file':
          return await this.undoDeleteFile(data, workspacePath);
        
        case 'patch_file':
          return await this.undoPatchFile(data, workspacePath);
        
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
      return { success: true }; // Nothing to redo if tool failed
    }

    const { toolName } = toolExecution;
    const data = toolExecution.result.data as Record<string, unknown>;

    try {
      switch (toolName) {
        case 'write_to_file':
          return await this.redoWriteFile(data, workspacePath);
        
        case 'edit_file':
          return await this.redoEditFile(data, workspacePath);
        
        case 'delete_file':
          return await this.redoDeleteFile(data, workspacePath);
        
        case 'patch_file':
          return await this.redoPatchFile(data, workspacePath);
        
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

    const absolutePath = path.join(workspacePath, filePath);
    const uri = vscode.Uri.file(absolutePath);

    if (action === 'created') {
      // File was created, delete it
      try {
        await vscode.workspace.fs.delete(uri, { recursive: false, useTrash: false });
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
   * Undo edit_file operation
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
      const contentBytes = Buffer.from(originalContent, 'utf8');
      await vscode.workspace.fs.writeFile(uri, contentBytes);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to restore edited file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
   * Undo patch_file operation
   */
  private async undoPatchFile(
    data: Record<string, unknown>,
    workspacePath: string
  ): Promise<{ success: boolean; error?: string }> {
    const filePath = data.path as string;
    const originalContent = data.originalContent as string;

    const absolutePath = path.join(workspacePath, filePath);
    const uri = vscode.Uri.file(absolutePath);

    try {
      const contentBytes = Buffer.from(originalContent, 'utf8');
      await vscode.workspace.fs.writeFile(uri, contentBytes);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to restore patched file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to redo write file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Redo edit_file operation
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
   * Redo patch_file operation
   */
  private async redoPatchFile(
    data: Record<string, unknown>,
    workspacePath: string
  ): Promise<{ success: boolean; error?: string }> {
    const filePath = data.path as string;
    const newContent = data.newContent as string;

    const absolutePath = path.join(workspacePath, filePath);
    const uri = vscode.Uri.file(absolutePath);

    try {
      const contentBytes = Buffer.from(newContent, 'utf8');
      await vscode.workspace.fs.writeFile(uri, contentBytes);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to redo patch file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
