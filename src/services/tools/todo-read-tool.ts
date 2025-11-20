import { ITool, ToolExecutionResult } from './tool.interface';
import { TodoWriteTool } from './todo-write-tool';

export class TodoReadTool implements ITool {
  name = 'todo_read';

  async execute(_parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    try {
      const sessionKey = 'default';
      const tasks = TodoWriteTool.getTodos(sessionKey);

      return {
        success: true,
        data: {
          tasks,
          count: tasks.length,
          message: tasks.length > 0 
            ? `Found ${tasks.length} task(s)` 
            : 'No tasks in the list',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read todos: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
