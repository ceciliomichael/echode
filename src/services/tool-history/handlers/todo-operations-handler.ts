import type { IToolHistoryHandler } from './handler.interface';
import type { ToolHistoryResult, ToolDataRecord } from '../types';
import { TodoWriteTool, type TodoTask } from '../../tools/todo-write-tool';

/**
 * Handler for todo operation tools: todo_write
 */
export class TodoOperationsHandler implements IToolHistoryHandler {
  readonly supportedTools = ['todo_write'];

  async undo(
    toolName: string,
    data: ToolDataRecord,
    _workspacePath: string
  ): Promise<ToolHistoryResult> {
    if (toolName === 'todo_write') {
      return this.undoTodoWrite(data);
    }
    return { success: true };
  }

  async redo(
    toolName: string,
    data: ToolDataRecord,
    _workspacePath: string
  ): Promise<ToolHistoryResult> {
    if (toolName === 'todo_write') {
      return this.redoTodoWrite(data);
    }
    return { success: true };
  }

  /**
   * Undo todo_write operation
   */
  private async undoTodoWrite(
    data: ToolDataRecord
  ): Promise<ToolHistoryResult> {
    try {
      const oldTasks = data.oldTasks;
      const sessionKey = (data.sessionKey as string) || 'default';

      // Restore old state (null means clear todos)
      TodoWriteTool.undoTodoWrite(
        oldTasks === null || oldTasks === undefined ? null : oldTasks as TodoTask[],
        sessionKey
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to undo todo_write: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Redo todo_write operation
   */
  private async redoTodoWrite(
    data: ToolDataRecord
  ): Promise<ToolHistoryResult> {
    try {
      const tasks = data.tasks as TodoTask[];
      const sessionKey = (data.sessionKey as string) || 'default';

      // Restore new state
      TodoWriteTool.redoTodoWrite(tasks, sessionKey);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to redo todo_write: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}