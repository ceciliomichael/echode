import type { ToolExecutionState } from './tool';

export type MessageRole = 'user' | 'assistant';

export interface WorkspaceCheckpoint {
  id: string;
  timestamp: number;
  files: Record<string, string>; // relativePath -> content
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  toolExecutions?: Map<string, ToolExecutionState>;
  hidden?: boolean;
  checkpoint?: WorkspaceCheckpoint; // Only for user messages
}