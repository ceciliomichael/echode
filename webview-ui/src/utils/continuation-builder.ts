import type { Message, ImageAttachment } from '../types/chat';
import type { ChatMessage } from '../types/chat-api';
import type { WorkspaceContext } from '../types/workspace';
import type { ChatMode } from '../types/chat-mode';
import { getSystemPrompt } from './prompts';
import { formatToolResultsForHistory } from './tool-result-formatter';
import { buildChatMessage, getCurrentModel, isVisionCapableModel } from './vision-utils';
import { summarizeToolSections } from './tool-context-cleaner';

/**
 * Context Management Constants
 * Based on proven patterns from production AI coding assistants
 */
const MAX_HISTORY_MESSAGES = 20;        // Maximum conversation turns to keep
const MAX_DIAGNOSTICS_CHARS = 4000;     // Max chars for diagnostics
const N_MESSAGES_TO_ALWAYS_KEEP = 4;    // Always keep last N messages (like KiloCode's N=3)

/**
 * Context truncation notice - shown when older messages are removed
 */
const CONTEXT_TRUNCATION_NOTICE = 
  `[NOTE] Some previous conversation history has been removed to maintain optimal context window length. ` +
  `The initial user task and the most recent exchanges have been retained for continuity.`;

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
 * Build continuation history for chat continuation after tool execution.
 * 
 * Context Management Strategy (based on KiloCode patterns):
 * 1. Always keep the first message (original user task for context)
 * 2. If truncation needed, insert a notice explaining history was removed
 * 3. Always keep the last N messages for continuity
 * 4. Tool results are formatted concisely to avoid context bloat
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

  // Context management: Keep first message + last N messages, with truncation notice if needed
  let messagesToInclude: Message[];
  let wasTruncated = false;

  if (currentMessages.length > MAX_HISTORY_MESSAGES) {
    // Keep first message (original task) + last N messages
    const firstMessage = currentMessages[0];
    const lastMessages = currentMessages.slice(-N_MESSAGES_TO_ALWAYS_KEEP);
    
    // Check if first message is already in the last messages (avoid duplicate)
    if (lastMessages.includes(firstMessage)) {
      messagesToInclude = lastMessages;
    } else {
      messagesToInclude = [firstMessage, ...lastMessages];
    }
    wasTruncated = true;
  } else {
    messagesToInclude = currentMessages;
  }

  // Add first message (original task context)
  if (messagesToInclude.length > 0) {
    const firstMsg = messagesToInclude[0];
    
    // If truncated, clean any embedded tool sections from old message content
    const cleanedContent = wasTruncated 
      ? summarizeToolSections(firstMsg.content)
      : firstMsg.content;
    
    const chatMessage = buildChatMessage(
      firstMsg.role,
      cleanedContent,
      firstMsg.attachments,
      modelSupportsVision
    );
    continuationHistory.push(chatMessage);

    // Add tool results for first message if any
    // When truncated, only add a brief summary instead of full results
    if (firstMsg.toolExecutions && firstMsg.toolExecutions.size > 0) {
      if (wasTruncated) {
        // Summarize old tool results
        const toolNames = Array.from(firstMsg.toolExecutions.values())
          .map(t => t.toolName)
          .slice(0, 5)
          .join(', ');
        continuationHistory.push({
          role: 'user',
          content: `[Previous tools used: ${toolNames}]`,
        });
      } else {
        // Keep full tool results for recent messages
        const toolResults = formatToolResultsForHistory(firstMsg.toolExecutions, mode);
        if (toolResults.length > 0) {
          continuationHistory.push({
            role: 'user',
            content: `<previous_tool_results>\n${toolResults.join('\n\n---\n\n')}\n</previous_tool_results>`,
          });
        }
      }
    }
  }

  // If truncated, add a notice so the AI knows context was removed
  if (wasTruncated) {
    continuationHistory.push({
      role: 'user',
      content: CONTEXT_TRUNCATION_NOTICE,
    });
  }

  // Add remaining messages (skip first since we already added it)
  for (let i = 1; i < messagesToInclude.length; i++) {
    const msg = messagesToInclude[i];
    
    // Build message with vision support if available
    const chatMessage = buildChatMessage(
      msg.role,
      msg.content,
      msg.attachments,
      modelSupportsVision
    );
    continuationHistory.push(chatMessage);

    // Add tool results for this message
    if (msg.toolExecutions && msg.toolExecutions.size > 0) {
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

  // Build the tool result message in a structured format (like how Claude receives context)
  const todoContext = buildTodoContext(currentTodos);

  const boundedDiagnosticsText = diagnosticsText.length > MAX_DIAGNOSTICS_CHARS
    ? `${diagnosticsText.slice(0, MAX_DIAGNOSTICS_CHARS)}\n... [truncated]`
    : diagnosticsText;

  // Structure the tool result message clearly with sections
  let toolResultMessage = '<tool_results>\n';
  toolResultMessage += toolResultText;
  toolResultMessage += '\n</tool_results>';

  // Add diagnostics section if present
  if (boundedDiagnosticsText.trim()) {
    toolResultMessage += '\n\n<diagnostics>\n';
    toolResultMessage += boundedDiagnosticsText;
    toolResultMessage += '\n</diagnostics>';
  }

  // Add todo context if present
  if (todoContext.trim()) {
    toolResultMessage += '\n' + todoContext;
  }

  // Collect files already read in this conversation to prevent re-reading
  const filesAlreadyRead = new Set<string>();
  for (const msg of currentMessages) {
    if (msg.toolExecutions) {
      msg.toolExecutions.forEach((exec) => {
        if (exec.toolName === 'read_file' && exec.result?.success && exec.parameters?.path) {
          filesAlreadyRead.add(String(exec.parameters.path));
        }
      });
    }
  }
  
  // Add reminder about files already read
  if (filesAlreadyRead.size > 0) {
    const filesList = Array.from(filesAlreadyRead).slice(0, 10).join(', ');
    toolResultMessage += `\n\n<files_already_read>\nYou have already read these files: ${filesList}\nPlease do not read them again. Use the content from earlier in this conversation.\n</files_already_read>`;
  }

  // Add concise continuation instruction
  toolResultMessage += '\n\n[Continue based on the tool results above. Please stay focused and do not re-read files you already have.]';

  continuationHistory.push({
    role: 'user',
    content: toolResultMessage,
  });

  return continuationHistory;
}

/**
 * Estimate token count from text using ~4 characters per token
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Calculate total context tokens for messages
 */
export function calculateContextTokens(
  systemPrompt: string,
  messages: Message[]
): number {
  let tokens = estimateTokens(systemPrompt);
  
  for (const msg of messages) {
    tokens += estimateTokens(msg.content);
    
    if (msg.toolExecutions && msg.toolExecutions.size > 0) {
      msg.toolExecutions.forEach((execution) => {
        tokens += estimateTokens(execution.toolName);
        tokens += estimateTokens(JSON.stringify(execution.parameters || {}));
        if (execution.result?.data) {
          tokens += estimateTokens(JSON.stringify(execution.result.data));
        }
      });
    }
  }
  
  return tokens;
}
