import type { ToolExecutionState } from './tool';
import type { ImageAttachment } from './chat';

export interface ChatSessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string | Date;
  toolExecutions?: Array<[string, ToolExecutionState]>;
  hidden?: boolean;
  attachments?: ImageAttachment[];
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
  uiState?: {
    editingMessageId: string | null;
    revertPreviewMessageId: string | null;
  };
  compressedContext?: {
    messages: ChatSessionMessage[];
    tokenCount: number;
    anchorId: string; // ID of message that triggered compression
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
