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
      const todosMarkdown = parameters.todos as string | undefined;

      let tasks: TodoTask[] | undefined;

      if (Array.isArray(tasksParam)) {
        tasks = tasksParam as TodoTask[];
      } else if (typeof todosMarkdown === 'string') {
        const parsed = parseMarkdownTodos(todosMarkdown);
        if (parsed.length === 0) {
          return {
            success: false,
            error: 'Todos parameter is not a valid markdown checklist. Use lines like "- [ ] task" or "- [x] task".',
          };
        }
        tasks = parsed;
      } else {
        return {
          success: false,
          error: 'Tasks parameter must be an array of TodoTask objects with id, content, and status, or provide a `todos` markdown checklist string.',
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
      
      // Capture old state for undo
      const oldTasks = todoStorage.get(sessionKey) || null;
      
      todoStorage.set(sessionKey, tasks);

      return {
        success: true,
        data: {
          message: `Updated todo list with ${tasks.length} task(s)`,
          tasks,
          oldTasks, // Include old state for undo
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

function parseMarkdownTodos(md: string): TodoTask[] {
  if (typeof md !== 'string') {
    return [];
  }

  const lines = md
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const tasks: TodoTask[] = [];
  let index = 1;

  for (const line of lines) {
    const match = line.match(/^(?:-\s*)?\[\s*([ xX\-~])\s*\]\s+(.+)$/);
    if (!match) {
      continue;
    }

    const marker = match[1];
    const content = match[2];

    let status: TodoTask['status'] = 'pending';
    if (marker === 'x' || marker === 'X') {
      status = 'completed';
    } else if (marker === '-' || marker === '~') {
      status = 'in_progress';
    }

    tasks.push({
      id: String(index++),
      content,
      status,
    });
  }

  return tasks;
}
