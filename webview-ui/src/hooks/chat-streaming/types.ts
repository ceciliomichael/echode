import type { Message, ImageAttachment } from '../../types/chat';
import type { ChatMessage } from '../../types/chat-api';
import type { ChatMode } from '../../types/chat-mode';
import type { ToolExecutionState } from '../../types/tool';
import type { Provider } from '../../types/api-settings';

/**
 * Locked configuration - captured at the start of streaming
 * to ensure the same model AND mode are used throughout tool execution and continuation
 * even if user changes settings while AI is working
 */
export interface LockedModelConfig {
  provider: Provider;
  model: string;
  mode: ChatMode;
}

/**
 * Props passed to useChatStreaming hook
 */
export interface ChatStreamingProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  setIsExecutingTool: React.Dispatch<React.SetStateAction<boolean>>;
  isStreamingRef: React.MutableRefObject<boolean>;
  isExecutingToolRef: React.MutableRefObject<boolean>;
  isStreaming: boolean;
  isExecutingTool: boolean;
  sendingMessageRef: React.MutableRefObject<boolean>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  toolAbortControllerRef: React.MutableRefObject<AbortController>;
  hasStreamedContentRef: React.MutableRefObject<boolean>;
  executeToolAndContinue: (
    assistantContent: string,
    assistantMessageId: string,
    chatHistory: ChatMessage[],
    messagesToSend: Message[],
    userContent: string,
    toolIndex?: number,
    userAttachments?: ImageAttachment[],
    bufferedToolResults?: string[],
    lockedConfig?: LockedModelConfig
  ) => Promise<void>;
  updateToolExecution: (messageId: string, toolExecutionId: string, state: ToolExecutionState) => void;
  isStoppingRef: React.MutableRefObject<boolean>;
  saveSession: (overrideMessages?: Message[]) => void;
  mode: ChatMode;
  messagesRef: React.MutableRefObject<Message[]>;
}

/**
 * Context for building chat history
 */
export interface ChatHistoryContext {
  systemPrompt: string;
  contextMessages: Message[];
  content: string;
  attachments: ImageAttachment[] | undefined;
  modelSupportsVision: boolean;
  mode: ChatMode;
}

/**
 * Context for forced echo search execution
 */
export interface ForcedEchoSearchContext {
  content: string;
  attachments: ImageAttachment[] | undefined;
  systemPrompt: string;
  messagesToSend: Message[];
  assistantMessageId: string;
  modelSupportsVision: boolean;
  mode: ChatMode;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsExecutingTool: React.Dispatch<React.SetStateAction<boolean>>;
  executeToolAndContinue: ChatStreamingProps['executeToolAndContinue'];
  lockedConfig?: LockedModelConfig;
}

/**
 * Context for streaming loop execution
 */
export interface StreamingLoopContext {
  finalChatHistory: ChatMessage[];
  messagesToSend: Message[];
  content: string;
  attachments: ImageAttachment[] | undefined;
  assistantMessageId: string;
  mode: ChatMode;
  lockedConfig: LockedModelConfig;
  isStoppingRef: React.MutableRefObject<boolean>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  hasStreamedContentRef: React.MutableRefObject<boolean>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsExecutingTool: React.Dispatch<React.SetStateAction<boolean>>;
  updateToolExecution: ChatStreamingProps['updateToolExecution'];
  executeToolAndContinue: ChatStreamingProps['executeToolAndContinue'];
  getToolExecutor: () => import('../../lib/tool-executor').ToolExecutor;
}
