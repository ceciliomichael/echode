import type { WorkspaceCheckpoint } from './chat';
import type { ToolExecutionState } from './tool';

export interface ChatSessionMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string | Date;
  toolExecutions?: Array<[string, ToolExecutionState]>;
  hidden?: boolean;
  checkpoint?: WorkspaceCheckpoint;
}

export interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
  createdAt: number;
  workspaceId?: string;
  messages: ChatSessionMessage[];
  metadata: {
    messageCount: number;
    preview: string;
  };
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  timestamp: number;
  createdAt: number;
  messageCount: number;
  preview: string;
}
