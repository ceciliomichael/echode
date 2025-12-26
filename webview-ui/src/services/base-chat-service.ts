import type { ChatMessage } from '../types/chat-api';

/**
 * Configuration for chat service initialization
 */
export interface ChatServiceConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  baseURL: string;
  reasoningEffort?: string;
  zaiThinking?: boolean;
  qwenCodeOauthPath?: string;
  enabledTools?: Array<{ id: string; enabled: boolean }>;
  /** Current chat mode for mode-specific behavior */
  chatMode?: 'agent' | 'plan' | 'ask' | 'general' | 'chat' | 'review' | 'yolo';
  /** Timeout in ms before treating a stream as stalled and retrying */
  streamingTimeout: number;
}

/**
 * Parameters for streaming chat requests
 */
export interface StreamChatParams {
  messages: ChatMessage[];
  signal?: AbortSignal;
  configOverride?: Partial<ChatServiceConfig> & { provider?: string };
}

/**
 * Base interface for chat service implementations
 */
export interface IChatService {
  streamChat(params: StreamChatParams): AsyncGenerator<string, void, unknown>;
}
