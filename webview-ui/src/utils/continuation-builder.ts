import type { Message } from '../types/chat';
import type { ChatMessage } from '../types/chat-api';
import type { WorkspaceContext } from '../types/workspace';
import type { ChatMode } from '../types/chat-mode';
import { getSystemPrompt } from './prompts';
import { formatToolResultsForHistory } from './tool-result-formatter';

interface TodoItem {
  id: string;
  content: string;
  status: string;
}

/**
 * Build todo context for AI
 */
export function buildTodoContext(todos: TodoItem[]): string {
  if (todos.length === 0) return '';

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
  if (pendingTasks) todoContext += `Pending:\n${pendingTasks}\n\n`;
  if (inProgressTasks) todoContext += `In Progress:\n${inProgressTasks}\n\n`;
  if (completedTasks) todoContext += `Completed:\n${completedTasks}\n`;
  todoContext += '</current_todo_list>\n\n';
  
  const hasIncompleteTasks = pendingTasks || inProgressTasks;
  if (hasIncompleteTasks) {
    todoContext += '[CRITICAL REMINDER: After completing a task, you MUST immediately use todo_write to mark it as completed BEFORE starting the next task. Do NOT proceed to the next task without updating the todo list first. This is essential for tracking progress.]';
  } else {
    todoContext += '[INSTRUCTION: All tasks in the todo list are now completed. The todo list accurately reflects the current state - do NOT update it again unless the user requests new tasks or changes.]';
  }

  return todoContext;
}

/**
 * Build continuation history for chat continuation after tool execution
 */
export function buildContinuationHistory(
  workspace: WorkspaceContext,
  currentMessages: Message[],
  userContent: string,
  assistantContent: string,
  toolResultText: string,
  diagnosticsText: string,
  currentTodos: TodoItem[],
  mode: ChatMode = 'agent'
): ChatMessage[] {
  const systemPrompt = getSystemPrompt(workspace, mode);

  const continuationHistory: ChatMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ];

  // Add previous messages with their tool results
  for (const msg of currentMessages) {
    continuationHistory.push({
      role: msg.role,
      content: msg.content,
    });

    if (msg.toolExecutions && msg.toolExecutions.size > 0) {
      const toolResults = formatToolResultsForHistory(msg.toolExecutions);

      if (toolResults.length > 0) {
        continuationHistory.push({
          role: 'user',
          content: `<previous_tool_results>\n${toolResults.join('\n\n---\n\n')}\n</previous_tool_results>`,
        });
      }
    }
  }

  // Add current user message and assistant response
  continuationHistory.push({
    role: 'user',
    content: userContent,
  });
  continuationHistory.push({
    role: 'assistant',
    content: assistantContent,
  });

  // Add current tool execution result with todo context and diagnostics
  const todoContext = buildTodoContext(currentTodos);

  continuationHistory.push({
    role: 'user',
    content: `Tool execution results:\n${toolResultText}${todoContext}${diagnosticsText}\n\n[INSTRUCTION: Process these tool results and continue your response. You have access to previous tool results in <previous_tool_results> tags. Maintain all system prompt rules, tool protocols, and formatting requirements. Stay focused on the original user request.]`,
  });

  return continuationHistory;
}
