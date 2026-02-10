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
      const tasksParam = parameters.tasks as unknown;

      if (!Array.isArray(tasksParam)) {
        return {
          success: false,
          error: 'Tasks parameter must be an array of TodoTask objects with id, content, and status.',
        };
      }

      const tasks = tasksParam as TodoTask[];

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

      // Store tasks (using provided session key or default)
      const sessionKey = typeof parameters.sessionKey === 'string' ? parameters.sessionKey : 'default';
      
      // Capture old state for undo
      const oldTasks = todoStorage.get(sessionKey) || null;
      
      todoStorage.set(sessionKey, tasks);

      const allCompleted = tasks.length > 0 && tasks.every(t => t.status === 'completed');

      return {
        success: true,
        data: {
          message: allCompleted
            ? `All ${tasks.length} task(s) completed. You are DONE.`
            : `Updated todo list with ${tasks.length} task(s)`,
          tasks,
          allCompleted,
          oldTasks, // Include old state for undo
          sessionKey, // Include session key for history tracking
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to write todos: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Static method to get current todos
  static getTodos(sessionKey: string = 'default'): TodoTask[] {
    return todoStorage.get(sessionKey) || [];
  }

  // Static method to clear todos
  static clearTodos(sessionKey: string = 'default'): void {
    todoStorage.delete(sessionKey);
  }

  // Static method to undo a todo_write operation
  static undoTodoWrite(oldTasks: TodoTask[] | null, sessionKey: string = 'default'): void {
    if (oldTasks === null) {
      // No previous state, clear todos
      todoStorage.delete(sessionKey);
    } else {
      // Restore previous state
      todoStorage.set(sessionKey, oldTasks);
    }
  }

  // Static method to redo a todo_write operation
  static redoTodoWrite(tasks: TodoTask[], sessionKey: string = 'default'): void {
    todoStorage.set(sessionKey, tasks);
  }
}
