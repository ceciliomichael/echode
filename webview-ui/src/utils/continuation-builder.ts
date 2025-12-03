import type { Message, ImageAttachment } from '../types/chat';
import type { ChatMessage } from '../types/chat-api';
import type { WorkspaceContext } from '../types/workspace';
import type { ChatMode } from '../types/chat-mode';
import { getSystemPrompt } from './prompts';
import { formatToolResultsForHistory } from './tool-result-formatter';
import { buildChatMessage, getCurrentModel, isVisionCapableModel } from './vision-utils';

const MAX_HISTORY_MESSAGES = 20;
const MAX_TOOL_RESULTS_CHARS = 8000;
const MAX_DIAGNOSTICS_CHARS = 4000;

interface TodoItem {
  id: string;
  content: string;
  status: string;
}

/**
 * Build todo context for AI
 */
export function buildTodoContext(todos: TodoItem[]): string {
  if (todos.length === 0) {return '';}

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
  if (pendingTasks) {todoContext += `Pending:\n${pendingTasks}\n\n`;}
  if (inProgressTasks) {todoContext += `In Progress:\n${inProgressTasks}\n\n`;}
  if (completedTasks) {todoContext += `Completed:\n${completedTasks}\n`;}
  todoContext += '</current_todo_list>\n\n';
  
  const hasIncompleteTasks = pendingTasks || inProgressTasks;
  if (hasIncompleteTasks) {
    todoContext += '[CRITICAL REMINDER: After completing a task, you MUST immediately use todo_write to mark it as completed BEFORE starting the next task. Do NOT proceed to the next task without updating the todo list first. This is essential for tracking progress.]';
  } else {
    todoContext += '[INSTRUCTION: All tasks in the todo list are now completed. Do NOT use todo_write again. You should now respond to the user to conclude the task.]';
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
  mode: ChatMode = 'agent',
  userAttachments?: ImageAttachment[]
): ChatMessage[] {
  // Check if current model supports vision for image attachments
  const currentModel = getCurrentModel();
  const modelSupportsVision = isVisionCapableModel(currentModel);
  const systemPrompt = getSystemPrompt(workspace, mode);

  const continuationHistory: ChatMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ];

  // Add previous messages with their tool results (bounded for context size)
  const messagesToInclude = currentMessages.length > MAX_HISTORY_MESSAGES
    ? currentMessages.slice(-MAX_HISTORY_MESSAGES)
    : currentMessages;

  for (const msg of messagesToInclude) {
    // Build message with vision support if available (preserves image attachments in history)
    const chatMessage = buildChatMessage(
      msg.role,
      msg.content,
      msg.attachments,
      modelSupportsVision
    );
    continuationHistory.push(chatMessage);

    if (msg.toolExecutions && msg.toolExecutions.size > 0) {
      // Filter tool results to only include tools available in current mode
      const toolResults = formatToolResultsForHistory(msg.toolExecutions, mode);

      if (toolResults.length > 0) {
        continuationHistory.push({
          role: 'user',
          content: `<previous_tool_results>\n${toolResults.join('\n\n---\n\n')}\n</previous_tool_results>`,
        });
      }
    }
  }

  // Add current user message with attachments and assistant response
  const currentUserMessage = buildChatMessage(
    'user',
    userContent,
    userAttachments,
    modelSupportsVision
  );
  continuationHistory.push(currentUserMessage);
  continuationHistory.push({
    role: 'assistant',
    content: assistantContent,
  });

  // Add current tool execution result with todo context and diagnostics
  const todoContext = buildTodoContext(currentTodos);

  const boundedToolResultText = toolResultText.length > MAX_TOOL_RESULTS_CHARS
    ? `${toolResultText.slice(0, MAX_TOOL_RESULTS_CHARS)}\n...[truncated tool results]`
    : toolResultText;

  const boundedDiagnosticsText = diagnosticsText.length > MAX_DIAGNOSTICS_CHARS
    ? `${diagnosticsText.slice(0, MAX_DIAGNOSTICS_CHARS)}\n...[truncated diagnostics]`
    : diagnosticsText;

  continuationHistory.push({
    role: 'user',
    content: `Tool execution results:\n${boundedToolResultText}${todoContext}${boundedDiagnosticsText}\n\n[INSTRUCTION: Use these tool results and diagnostics to continue. Follow your system prompt and tool rules. Respond concisely and stay focused on the original user request.]`,
  });

  return continuationHistory;
}
