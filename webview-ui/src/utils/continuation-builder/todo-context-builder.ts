/**
 * Todo context builder for AI continuation
 */

import type { TodoItem } from './types';
import type { ChatMode } from '../../types/chat-mode';

/**
 * Build todo context for AI
 * Mode-aware: Plan mode gets planning-focused instructions, Agent mode gets implementation instructions
 */
export function buildTodoContext(todos: TodoItem[], _mode: ChatMode = 'agent'): string {
  if (todos.length === 0) {
    return '';
  }

  const pendingTasks = todos
    .filter((t) => t.status === 'pending')
    .map((t) => `- ${t.content}`)
    .join('\n');
  const inProgressTasks = todos
    .filter((t) => t.status === 'in_progress')
    .map((t) => `- ${t.content}`)
    .join('\n');
  const completedTasks = todos
    .filter((t) => t.status === 'completed')
    .map((t) => `- ${t.content}`)
    .join('\n');

  let todoContext = '\n\n<current_todo_list>\n';
  if (pendingTasks) {
    todoContext += `Pending:\n${pendingTasks}\n\n`;
  }
  if (inProgressTasks) {
    todoContext += `In Progress:\n${inProgressTasks}\n\n`;
  }
  if (completedTasks) {
    todoContext += `Completed:\n${completedTasks}\n`;
  }
  todoContext += '</current_todo_list>';

  return todoContext;
}