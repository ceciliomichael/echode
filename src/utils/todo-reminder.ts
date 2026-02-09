import { ChatMessage, ChatMessageContent } from '../services/llm/llm-provider.interface';
import { TodoWriteTool, TodoTask } from '../services/tools/todo-write-tool';

/**
 * Strip <todo_reminder> blocks from a string
 */
function stripTodoReminders(content: string): string {
  return content.replace(/<todo_reminder>[\s\S]*?<\/todo_reminder>\s*/g, '').trim();
}

/**
 * Strip todo reminders from all messages (handles both string and multimodal content)
 */
function stripTodoRemindersFromMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map(msg => {
    if (typeof msg.content === 'string') {
      const stripped = stripTodoReminders(msg.content);
      if (stripped === msg.content) {
        return msg;
      }
      return { ...msg, content: stripped };
    }

    if (Array.isArray(msg.content)) {
      let changed = false;
      const newContent = msg.content.map(c => {
        if (c.type === 'text' && c.text) {
          const stripped = stripTodoReminders(c.text);
          if (stripped !== c.text) {
            changed = true;
            return { ...c, text: stripped };
          }
        }
        return c;
      }) as ChatMessageContent[];

      if (!changed) {
        return msg;
      }
      return { ...msg, content: newContent };
    }

    return msg;
  });
}

/**
 * Build a todo reminder string from current todo state
 * Returns null if no todos exist or all tasks are completed
 */
function buildTodoReminder(sessionKey?: string): string | null {
  const tasks = TodoWriteTool.getTodos(sessionKey);
  if (tasks.length === 0) {
    return null;
  }

  const completed = tasks.filter(t => t.status === 'completed').length;

  // Skip reminder if all tasks are completed
  if (completed === tasks.length) {
    return null;
  }
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const pending = tasks.filter(t => t.status === 'pending').length;

  const statusParts: string[] = [];
  if (completed > 0) {
    statusParts.push(`${completed} done`);
  }
  if (inProgress > 0) {
    statusParts.push(`${inProgress} in progress`);
  }
  if (pending > 0) {
    statusParts.push(`${pending} pending`);
  }

  const lines = tasks.map((t: TodoTask) => {
    const marker = t.status === 'completed' ? 'x'
      : t.status === 'in_progress' ? '-' : ' ';
    return `- [${marker}] ${t.content}`;
  });

  return `<todo_reminder>
[Tasks: ${completed}/${tasks.length} complete | ${statusParts.join(', ')}]
${lines.join('\n')}
</todo_reminder>`;
}

/**
 * Inject todo reminder into the last user message
 */
function injectReminderIntoLastUserMessage(messages: ChatMessage[], reminder: string): void {
  // Find last user message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'user') {
      continue;
    }

    if (Array.isArray(msg.content)) {
      // Multimodal: find text content and prepend reminder
      const textContent = msg.content.find(c => c.type === 'text');
      if (textContent && textContent.text !== undefined) {
        textContent.text = `${reminder}\n\n${textContent.text}`;
      }
    } else if (typeof msg.content === 'string') {
      // Simple string: prepend reminder
      msg.content = `${reminder}\n\n${msg.content}`;
    }
    break;
  }
}

/**
 * Main entry point: strip old todo reminders and inject fresh one
 * Skips injection if no todos exist
 */
export function processTodoReminders(messages: ChatMessage[], sessionKey?: string): ChatMessage[];
export function processTodoReminders(sessionKey: string | undefined, messages: ChatMessage[]): ChatMessage[];
export function processTodoReminders(
  arg1: ChatMessage[] | string | undefined,
  arg2?: string | ChatMessage[]
): ChatMessage[] {
  const messages = Array.isArray(arg1) ? arg1 : (Array.isArray(arg2) ? arg2 : []);
  const sessionKey = typeof arg1 === 'string' ? arg1 : (typeof arg2 === 'string' ? arg2 : undefined);
  // Strip old reminders from ALL messages
  const cleaned = stripTodoRemindersFromMessages(messages);

  // Build fresh reminder
  const reminder = buildTodoReminder(sessionKey);
  if (!reminder) {
    return cleaned;
  }

  // Inject into last user message
  injectReminderIntoLastUserMessage(cleaned, reminder);

  return cleaned;
}