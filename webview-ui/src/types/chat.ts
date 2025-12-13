import type { ToolExecutionState } from './tool';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ImageAttachment {
  data: string; // base64 encoded image data
  mimeType: string; // e.g., 'image/jpeg', 'image/png'
  size: number; // file size in bytes
  name?: string; // original filename
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  toolExecutions?: Map<string, ToolExecutionState>;
  hidden?: boolean;
  attachments?: ImageAttachment[];
  isSummary?: boolean;
  summarizedMessageCount?: number;
}