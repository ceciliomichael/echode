import { ITool, ToolExecutionResult } from './tool.interface';

export interface TodoTask {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

// Session storage for todos (resets when extension reloads)
const todoStorage = new Map<string, TodoTask[]>();

export class TodoWriteTool implements ITool {
  name = 'todo_write';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    try {
      const tasks = parameters.tasks as TodoTask[] | undefined;
      
      if (!tasks || !Array.isArray(tasks)) {
        return {
          success: false,
          error: 'Tasks parameter must be an array of TodoTask objects with id, content, and status',
        };
      }

      // Validate task structure
      for (const task of tasks) {
        if (!task.id || !task.content || !task.status) {
          return {
            success: false,
            error: 'Each task must have id, content, and status fields',
          };
        }
        
        if (!['pending', 'in_progress', 'completed'].includes(task.status)) {
          return {
            success: false,
            error: 'Task status must be one of: pending, in_progress, completed',
          };
        }
      }

      // Store tasks (using 'default' as session key for now)
      const sessionKey = 'default';
      todoStorage.set(sessionKey, tasks);

      return {
        success: true,
        data: {
          message: `Updated todo list with ${tasks.length} task(s)`,
          tasks,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to write todos: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Static method to get current todos (used by TodoReadTool)
  static getTodos(sessionKey: string = 'default'): TodoTask[] {
    return todoStorage.get(sessionKey) || [];
  }

  // Static method to clear todos
  static clearTodos(sessionKey: string = 'default'): void {
    todoStorage.delete(sessionKey);
  }
}
