import { ListChecks, Circle, CheckCircle2, Loader2 } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';

/**
 * Todo Read Tool
 */
async function executeTodoRead(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('todo_read', parameters, signal);
}

// Register todo_read tool
registerToolPlugin({
  metadata: {
    id: 'todo_read',
    name: 'Todo Read',
    description: 'Read current todo list tasks',
    aiDescription: 'Read the current todo list to see all tasks and their status.',
    icon: ListChecks,
    usage: 'Read the current session todo list',
    formatExample: '<todo_read></todo_read>',
  },
  handler: {
    execute: executeTodoRead,
  },
  renderer: (data: unknown) => {
    if (typeof data !== 'object' || data === null || !('tasks' in data)) {
      return (
        <div className="text-sm" style={{ color: 'var(--vscode-errorForeground)' }}>
          Failed to read todo list
        </div>
      );
    }

    const result = data as { tasks?: Array<{ id: string; content: string; status: string }> };
    const tasks = result?.tasks || [];

    if (tasks.length === 0) {
      return (
        <div className="text-sm" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          No tasks found
        </div>
      );
    }

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'completed':
          return (
            <CheckCircle2
              className="w-4 h-4"
              style={{ color: 'var(--vscode-testing-iconPassed)' }}
            />
          );
        case 'in_progress':
          return (
            <Loader2
              className="w-4 h-4 animate-spin"
              style={{ color: 'var(--vscode-charts-blue)' }}
            />
          );
        case 'pending':
        default:
          return (
            <Circle
              className="w-4 h-4"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            />
          );
      }
    };

    return (
      <div className="text-sm">
        <div 
          className="font-semibold mb-2 text-xs uppercase tracking-wide" 
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          Todo List ({tasks.filter(t => t.status === 'completed').length}/{tasks.length})
        </div>
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2.5 py-1">
              <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                {getStatusIcon(task.status)}
              </div>
              <span
                className={`text-sm flex-1 leading-snug ${
                  task.status === 'completed' ? 'line-through opacity-60' : ''
                }`}
                style={{ color: 'var(--vscode-input-foreground)' }}
              >
                {task.content}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  },
});
