import type { ToolExecutionState } from './tool';

export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  toolExecutions?: Map<string, ToolExecutionState>;
  hidden?: boolean;
}