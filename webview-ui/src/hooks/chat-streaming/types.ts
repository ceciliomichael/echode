import type { Message, ImageAttachment } from '../../types/chat';
import type { ChatMessage } from '../../types/chat-api';
import type { ChatMode } from '../../types/chat-mode';
import type { ToolExecutionState } from '../../types/tool';

/**
 * Props passed to useChatStreaming hook
 */
export interface ChatStreamingProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  setIsExecutingTool: React.Dispatch<React.SetStateAction<boolean>>;
  setIsCompressing: React.Dispatch<React.SetStateAction<boolean>>;
  setCompressedContextTokens: React.Dispatch<React.SetStateAction<number | null>>;
  setCompressedMessages: React.Dispatch<React.SetStateAction<Message[] | null>>;
  setCompressionAnchorId: React.Dispatch<React.SetStateAction<string | null>>;
  compressedMessagesRef: React.MutableRefObject<Message[] | null>;
  compressedContextTokensRef: React.MutableRefObject<number | null>;
  isStreamingRef: React.MutableRefObject<boolean>;
  isExecutingToolRef: React.MutableRefObject<boolean>;
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
    bufferedToolResults?: string[]
  ) => Promise<void>;
  updateToolExecution: (messageId: string, toolExecutionId: string, state: ToolExecutionState) => void;
  isStoppingRef: React.MutableRefObject<boolean>;
  saveSession: (overrideMessages?: Message[]) => void;
  mode: ChatMode;
}

/**
 * Context for compression operations
 */
export interface CompressionContext {
  messagesToSend: Message[];
  systemPromptTokens: number;
  newMessageTokens: number;
  maxTokens: number;
  currentCompressedMessages: Message[] | null;
  currentCompressedTokens: number | null;
  userMessageId: string;
  assistantMessageId: string;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  setIsCompressing: React.Dispatch<React.SetStateAction<boolean>>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setCompressedMessages: React.Dispatch<React.SetStateAction<Message[] | null>>;
  setCompressedContextTokens: React.Dispatch<React.SetStateAction<number | null>>;
  setCompressionAnchorId: React.Dispatch<React.SetStateAction<string | null>>;
  compressedMessagesRef: React.MutableRefObject<Message[] | null>;
  compressedContextTokensRef: React.MutableRefObject<number | null>;
}

/**
 * Result of compression preparation
 */
export interface CompressionResult {
  contextMessages: Message[];
  wasAborted: boolean;
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
  isStoppingRef: React.MutableRefObject<boolean>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  hasStreamedContentRef: React.MutableRefObject<boolean>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsExecutingTool: React.Dispatch<React.SetStateAction<boolean>>;
  updateToolExecution: ChatStreamingProps['updateToolExecution'];
  executeToolAndContinue: ChatStreamingProps['executeToolAndContinue'];
  getToolExecutor: () => import('../../lib/tool-executor').ToolExecutor;
}
